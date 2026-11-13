// ============================================================
// АВТОМАТИК СМС
//  1) Қарзли буюртма яратилганда мижозга дарҳол СМС.
//  2) Қарздор мижозларга ҳар N кунда эслатма (дастур очиқ турганда).
// ============================================================

const {
  Client,
  Order,
  Payment,
} = require("../models");

const SmsSetting = require("../models/smsSetting");

const {
  isConfigured,
  sendViaProvider,
} = require("./smsSender");

const DEFAULT_ORDER_TEMPLATE =
  "Ассалому алайкум, ҳурматли {name}! Буюртмангиз қабул қилинди. Ушбу буюртма бўйича қарзингиз: {debt} сўм. Умумий қарзингиз: {total} сўм.";

// Эслатмалар фақат шу соатлар оралиғида юборилади (тунда безовта қилмаслик учун)
const REMINDER_HOUR_FROM = 9;
const REMINDER_HOUR_TO = 20;

const REMINDER_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const REMINDER_FIRST_CHECK_MS = 60 * 1000;
const REMINDER_BATCH_LIMIT = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function formatAmount(value) {
  return String(Math.round(Number(value) || 0)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    " "
  );
}

function orderDebt(order) {
  const total =
    Number(order.serviceFee || 0) +
    Number(order.productsPrice || 0);

  const paid = (order.Payments || []).reduce(
    (sum, payment) =>
      sum + Number(payment.receivedAmount || 0),
    0
  );

  return Math.max(total - paid, 0);
}

// "901234567", "+998 90 123 45 67", "998901234567" → 998901234567
function toUzPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");

  if (digits.length === 9) {
    digits = `998${digits}`;
  }

  if (digits.length !== 12 || !digits.startsWith("998")) {
    return null;
  }

  return Number(digits);
}

function renderTemplate(template, values) {
  return String(template || "")
    .replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(values, key)
        ? String(values[key])
        : match
    )
    .trim();
}

function clampReminderDays(value) {
  const days = Math.round(Number(value));

  if (!Number.isFinite(days) || days < 1) {
    return 7;
  }

  return Math.min(days, 365);
}

async function loadClientWithOrders(clientId) {
  return Client.findByPk(clientId, {
    include: [
      {
        model: Order,
        as: "Orders",
        include: [
          {
            model: Payment,
            as: "Payments",
          },
        ],
      },
    ],
  });
}

// ------------------------------------------------------------
// 1) БУЮРТМА ЯРАТИЛГАНДА
// ------------------------------------------------------------

// Ҳеч қачон хато ташламайди: буюртма яратилиши СМСга боғлиқ бўлмаслиги керак.
// Қайтаради: { attempted, ok, message }
async function sendOrderSms(orderId) {
  try {
    const settings = await SmsSetting.findByPk(1);

    if (!settings || !settings.orderSmsEnabled) {
      return { attempted: false, ok: false, message: "" };
    }

    if (!isConfigured(settings)) {
      return {
        attempted: true,
        ok: false,
        message:
          "СМС юборилмади: юбориш усули созланмаган",
      };
    }

    const order = await Order.findByPk(orderId, {
      include: [{ model: Payment, as: "Payments" }],
    });

    if (!order) {
      return { attempted: false, ok: false, message: "" };
    }

    const debt = orderDebt(order);

    // Тўлиқ тўланган буюртма учун СМС юборилмайди
    if (debt <= 0) {
      return { attempted: false, ok: false, message: "" };
    }

    const client = await loadClientWithOrders(order.clientId);

    if (!client) {
      return { attempted: false, ok: false, message: "" };
    }

    const phone = toUzPhone(client.phone);

    if (!phone) {
      return {
        attempted: true,
        ok: false,
        message:
          "СМС юборилмади: мижоз телефон рақами нотўғри",
      };
    }

    const totalDebt = (client.Orders || []).reduce(
      (sum, item) => sum + orderDebt(item),
      0
    );

    const text = renderTemplate(
      settings.orderSmsTemplate || DEFAULT_ORDER_TEMPLATE,
      {
        name: client.name || "",
        debt: formatAmount(debt),
        total: formatAmount(totalDebt),
        duty: formatAmount(totalDebt),
      }
    );

    const outcome = await sendViaProvider(settings, [
      {
        user_sms_id: `order${Date.now()}`,
        to: phone,
        text,
      },
    ]);

    if (outcome.sent > 0) {
      await client.update({ lastSmsAt: new Date() });

      return {
        attempted: true,
        ok: true,
        message: "Мижозга СМС юборилди",
      };
    }

    return {
      attempted: true,
      ok: false,
      message: `СМС юборилмади: ${outcome.error || "номаълум хато"}`,
    };
  } catch (error) {
    console.error("ORDER SMS ERROR:", error);

    return {
      attempted: true,
      ok: false,
      message: `СМС юборилмади: ${error.message || "номаълум хато"}`,
    };
  }
}

// ------------------------------------------------------------
// 2) ДАВРИЙ ЭСЛАТМА
// ------------------------------------------------------------

let reminderRunning = false;

// options.now / options.ignoreHours — фақат синов учун
async function runReminders(options = {}) {
  if (reminderRunning) {
    return { skipped: "running" };
  }

  reminderRunning = true;

  try {
    const now = options.now || new Date();

    const settings = await SmsSetting.findByPk(1);

    if (!settings || !settings.reminderEnabled) {
      return { skipped: "disabled" };
    }

    if (!isConfigured(settings)) {
      return { skipped: "not_configured" };
    }

    const hour = now.getHours();

    if (
      !options.ignoreHours &&
      (hour < REMINDER_HOUR_FROM || hour >= REMINDER_HOUR_TO)
    ) {
      return { skipped: "quiet_hours" };
    }

    const days = clampReminderDays(settings.reminderDays);

    // Эслатма ёқилган вақт: шу пайтгача СМС олмаган мижозлар учун саноқ боши
    const startedAt = settings.reminderStartedAt
      ? new Date(settings.reminderStartedAt).getTime()
      : now.getTime();

    const clients = await Client.findAll({
      include: [
        {
          model: Order,
          as: "Orders",
          include: [{ model: Payment, as: "Payments" }],
        },
      ],
    });

    const due = [];

    for (const client of clients) {
      const totalDebt = (client.Orders || []).reduce(
        (sum, item) => sum + orderDebt(item),
        0
      );

      if (totalDebt <= 0) {
        continue;
      }

      const lastAt = client.lastSmsAt
        ? new Date(client.lastSmsAt).getTime()
        : startedAt;

      if (now.getTime() - lastAt < days * DAY_MS) {
        continue;
      }

      const phone = toUzPhone(client.phone);

      if (!phone) {
        continue;
      }

      due.push({ client, phone, totalDebt });

      if (due.length >= REMINDER_BATCH_LIMIT) {
        break;
      }
    }

    if (due.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const item of due) {
      const text = renderTemplate(settings.smsTemplate, {
        name: item.client.name || "",
        duty: formatAmount(item.totalDebt),
        total: formatAmount(item.totalDebt),
        debt: formatAmount(item.totalDebt),
      });

      try {
        const outcome = await sendViaProvider(settings, [
          {
            user_sms_id: `rem${Date.now()}${sent + failed}`,
            to: item.phone,
            text,
          },
        ]);

        if (outcome.sent > 0) {
          await item.client.update({ lastSmsAt: new Date() });
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error("REMINDER SMS ERROR:", error.message);

        failed++;

        // Телефонга/Эскизга уланиб бўлмаяпти: кейинги текширувда қайта уринилади
        break;
      }
    }

    console.log(
      `[SMS REMINDER] sent: ${sent}, failed: ${failed}`
    );

    return { sent, failed };
  } catch (error) {
    console.error("SMS REMINDER ERROR:", error);

    return { error: error.message };
  } finally {
    reminderRunning = false;
  }
}

function startReminderScheduler() {
  setTimeout(() => {
    runReminders();
  }, REMINDER_FIRST_CHECK_MS).unref();

  setInterval(() => {
    runReminders();
  }, REMINDER_CHECK_INTERVAL_MS).unref();

  console.log("[SMS REMINDER] Scheduler started");
}

module.exports = {
  DEFAULT_ORDER_TEMPLATE,
  clampReminderDays,
  sendOrderSms,
  runReminders,
  startReminderScheduler,
};
