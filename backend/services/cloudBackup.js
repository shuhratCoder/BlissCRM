// ============================================================
// СЕРВЕРДАГИ ЗАХИРА НУСХА (Admin CRM)
//
// Мижозлар, буюртмалар ва тўловлар JSON қилиб, gzip билан сиқилади
// ва Admin CRM серверига юборилади. Компьютер ишдан чиқса, янги
// компьютерда логин-парол билан кириб, шу нусхадан тикланади.
// ============================================================

const crypto = require("crypto");
const zlib = require("zlib");

const sequelize = require("../db");

const {
  Client,
  Order,
  Payment,
  Deadline,
  Product,
} = require("../models");

const LocalUser = require("../models/localUser");
const SmsSetting = require("../models/smsSetting");

const {
  createBackup,
} = require("./backupService");

const SNAPSHOT_VERSION = 1;

const FIRST_RUN_MS = 2 * 60 * 1000;
const INTERVAL_MS = 30 * 60 * 1000;

// Захира нусхага кирадиган СМС созламалари (логин/пароллар кирмайди:
// улар шу компьютернинг калити билан шифрланган).
const SMS_FIELDS = [
  "smsTemplate",
  "orderSmsEnabled",
  "orderSmsTemplate",
  "reminderEnabled",
  "reminderDays",
];

function adminUrl() {
  return (
    process.env.ADMIN_API_URL ||
    "https://blissmebel.uz/api"
  );
}

function plain(rows) {
  return rows.map((row) => row.toJSON());
}

// ------------------------------------------------------------
// SNAPSHOT
// ------------------------------------------------------------

async function buildSnapshot(localUser) {
  const [clients, orders, payments, deadlines, products, sms] =
    await Promise.all([
      Client.findAll({ order: [["createdAt", "ASC"]] }),
      Order.findAll({ order: [["createdAt", "ASC"]] }),
      Payment.findAll({ order: [["createdAt", "ASC"]] }),
      Deadline.findAll({ order: [["createdAt", "ASC"]] }),
      Product.findAll({ order: [["createdAt", "ASC"]] }),
      SmsSetting.findByPk(1),
    ]);

  const settings = {};

  if (sms) {
    for (const field of SMS_FIELDS) {
      settings[field] = sms[field];
    }
  }

  const content = {
    tables: {
      clients: plain(clients),
      orders: plain(orders),
      payments: plain(payments),
      deadlines: plain(deadlines),
      products: plain(products),
    },
    settings,
  };

  // Мазмун ўзгармаган бўлса қайта юбормаслик учун (вақт белгисисиз)
  const contentHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex");

  const snapshot = {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    ownerId: localUser.ownerId,
    counts: {
      clients: clients.length,
      orders: orders.length,
      payments: payments.length,
    },
    ...content,
  };

  return {
    snapshot,
    contentHash,
    counts: snapshot.counts,
  };
}

// ------------------------------------------------------------
// ADMIN API
// ------------------------------------------------------------

function unreachable(error) {
  const wrapped = new Error(
    "Серверга уланиб бўлмади. Интернетни текширинг."
  );

  wrapped.code = "ADMIN_UNREACHABLE";
  wrapped.cause = error;

  return wrapped;
}

async function adminFetch(localUser, path, options = {}) {
  if (!localUser.backupToken) {
    const error = new Error(
      "Захира нусха сервери уланмаган"
    );

    error.code = "BACKUP_NOT_LINKED";

    throw error;
  }

  let response;

  try {
    response = await fetch(`${adminUrl()}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${localUser.backupToken}`,
      },
      signal: AbortSignal.timeout(
        options.timeoutMs || 20000
      ),
    });
  } catch (networkError) {
    throw unreachable(networkError);
  }

  if (response.ok) {
    return response;
  }

  const result = await response
    .json()
    .catch(() => ({}));

  const error = new Error(
    result.code === "BACKUP_TOKEN_INVALID" ||
    result.code === "BACKUP_TOKEN_REQUIRED"
      ? "Серверга уланиш эскирган. Логин ва парол билан қайта уланг."
      : result.code === "OWNER_BLOCKED"
        ? "Ҳисоб блокланган"
        : result.code === "BACKUP_NOT_FOUND"
          ? "Серверда захира нусха топилмади"
          : response.status === 413
            ? "Захира нусха ҳажми жуда катта"
            : response.status === 404
              ? "Сервер захира нусхани қабул қилмайди (сервер янгиланмаган)"
              : response.status >= 500
                ? "Серверда вақтинча хатолик"
                : result.message ||
                  `Сервер хатоси (HTTP ${response.status})`
  );

  error.code =
    result.code || `HTTP_${response.status}`;

  throw error;
}

// ------------------------------------------------------------
// UPLOAD
// ------------------------------------------------------------

let uploadRunning = false;

// options.force — мазмун ўзгармаган бўлса ҳам юборилади
async function uploadBackup(options = {}) {
  if (uploadRunning) {
    return { skipped: "running" };
  }

  uploadRunning = true;

  let localUser = null;

  try {
    localUser = await LocalUser.findOne();

    if (!localUser) {
      return { skipped: "no_user" };
    }

    if (!localUser.backupToken) {
      return { skipped: "not_linked" };
    }

    const { snapshot, contentHash, counts } =
      await buildSnapshot(localUser);

    // Бўш база серверидаги яхши нусханинг устига ёзилмаслиги керак
    // (масалан, янги ўрнатилган ва ҳали тикланмаган дастур).
    if (counts.clients === 0 && counts.orders === 0) {
      return { skipped: "empty" };
    }

    if (
      !options.force &&
      localUser.lastBackupHash === contentHash
    ) {
      return { skipped: "unchanged" };
    }

    const body = zlib.gzipSync(
      Buffer.from(JSON.stringify(snapshot), "utf8"),
      { level: 9 }
    );

    const response = await adminFetch(
      localUser,
      "/backup",
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/octet-stream",
          "x-backup-clients": String(counts.clients),
          "x-backup-orders": String(counts.orders),
        },
        body,
        timeoutMs: 60000,
      }
    );

    const result = await response
      .json()
      .catch(() => ({}));

    await localUser.update({
      lastBackupAt: new Date(),
      lastBackupHash: contentHash,
      lastBackupError: null,
    });

    console.log(
      `[CLOUD BACKUP] uploaded ${body.length} bytes (${counts.clients} clients, ${counts.orders} orders)`
    );

    return {
      uploaded: true,
      sizeBytes: body.length,
      counts,
      backup: result.backup || null,
    };
  } catch (error) {
    console.error(
      "[CLOUD BACKUP] upload error:",
      error.message
    );

    if (localUser) {
      await localUser
        .update({
          lastBackupError: error.message,
        })
        .catch(() => {});
    }

    throw error;
  } finally {
    uploadRunning = false;
  }
}

// ------------------------------------------------------------
// SERVER INFO
// ------------------------------------------------------------

async function getServerInfo(localUser) {
  const response = await adminFetch(
    localUser,
    "/backup/info"
  );

  return response.json();
}

// ------------------------------------------------------------
// RESTORE
// ------------------------------------------------------------

function isArray(value) {
  return Array.isArray(value);
}

// Сервердаги нусхадан тиклаш: локал мижоз/буюртма/тўловлар
// нусхадагилари билан алмаштирилади.
async function restoreBackup(options = {}) {
  const localUser = await LocalUser.findOne();

  if (!localUser) {
    throw new Error("Локал фойдаланувчи топилмади");
  }

  const query = options.id
    ? `?id=${encodeURIComponent(options.id)}`
    : "";

  const response = await adminFetch(
    localUser,
    `/backup/download${query}`,
    { timeoutMs: 60000 }
  );

  const snapshot = parseSnapshot(
    Buffer.from(await response.arrayBuffer()),
    "Сервердаги захира нусха бузилган"
  );

  return applySnapshot(snapshot, localUser);
}

// Admin CRM'дан юклаб олинган файлдан тиклаш (.blissbak)
async function restoreFromFile(buffer) {
  const localUser = await LocalUser.findOne();

  if (!localUser) {
    throw new Error("Локал фойдаланувчи топилмади");
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Файл бўш");
  }

  const snapshot = parseSnapshot(
    buffer,
    "Файл захира нусха эмас ёки бузилган"
  );

  return applySnapshot(snapshot, localUser);
}

function parseSnapshot(compressed, errorMessage) {
  try {
    return JSON.parse(
      zlib.gunzipSync(compressed).toString("utf8")
    );
  } catch (parseError) {
    throw new Error(errorMessage);
  }
}

// Нусха мазмунини локал базага ёзиш (сервердан ҳам, файлдан ҳам)
async function applySnapshot(snapshot, localUser) {
  const tables = snapshot?.tables;

  if (
    snapshot?.version !== SNAPSHOT_VERSION ||
    !tables ||
    !isArray(tables.clients) ||
    !isArray(tables.orders) ||
    !isArray(tables.payments) ||
    !isArray(tables.deadlines)
  ) {
    throw new Error(
      "Захира нусха формати бу дастурга мос эмас"
    );
  }

  if (
    String(snapshot.ownerId) !==
    String(localUser.ownerId)
  ) {
    throw new Error(
      "Захира нусха бошқа ҳисобга тегишли"
    );
  }

  // Эҳтиёт учун: алмаштиришдан олдин локал файл нусхаси олинади
  try {
    await createBackup();
  } catch (backupError) {
    console.error(
      "[CLOUD BACKUP] local safety backup failed:",
      backupError.message
    );
  }

  const transaction =
    await sequelize.transaction();

  try {
    // Боғланишлар тартиби: аввал тобе жадваллар ўчирилади
    await Payment.destroy({ where: {}, transaction });
    await Deadline.destroy({ where: {}, transaction });
    await Order.destroy({ where: {}, transaction });
    await Client.destroy({ where: {}, transaction });
    await Product.destroy({ where: {}, transaction });

    const insert = { transaction, validate: false, hooks: false };

    await Client.bulkCreate(tables.clients, insert);

    if (isArray(tables.products) && tables.products.length) {
      await Product.bulkCreate(tables.products, insert);
    }

    await Order.bulkCreate(tables.orders, insert);
    await Payment.bulkCreate(tables.payments, insert);
    await Deadline.bulkCreate(tables.deadlines, insert);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    console.error(
      "[CLOUD BACKUP] restore error:",
      error
    );

    throw new Error(
      `Тиклашда хатолик: ${error.message}. Локал маълумотлар ўзгармади.`
    );
  }

  // СМС матнлари ва автоматик СМС созламалари (логин/паролсиз)
  if (snapshot.settings) {
    try {
      const [sms] = await SmsSetting.findOrCreate({
        where: { id: 1 },
        defaults: { id: 1 },
      });

      const update = {};

      for (const field of SMS_FIELDS) {
        if (
          snapshot.settings[field] !== undefined &&
          snapshot.settings[field] !== null
        ) {
          update[field] = snapshot.settings[field];
        }
      }

      if (update.reminderEnabled) {
        update.reminderStartedAt = new Date();
      }

      await sms.update(update);
    } catch (settingsError) {
      console.error(
        "[CLOUD BACKUP] settings restore failed:",
        settingsError.message
      );
    }
  }

  // Тикланган ҳолат "юборилмаган" деб белгиланади: кейинги автоматик
  // юборишда сервердаги бугунги нусха шу ҳолат билан янгиланади.
  await localUser.update({
    lastBackupHash: null,
    lastBackupError: null,
  });

  return {
    restored: true,
    createdAt: snapshot.createdAt,
    counts: {
      clients: tables.clients.length,
      orders: tables.orders.length,
      payments: tables.payments.length,
    },
  };
}

// ------------------------------------------------------------
// SCHEDULER
// ------------------------------------------------------------

function startCloudBackupScheduler() {
  const run = () => {
    uploadBackup().catch(() => {});
  };

  setTimeout(run, FIRST_RUN_MS).unref();
  setInterval(run, INTERVAL_MS).unref();

  console.log("[CLOUD BACKUP] Scheduler started");
}

module.exports = {
  buildSnapshot,
  uploadBackup,
  getServerInfo,
  restoreBackup,
  restoreFromFile,
  startCloudBackupScheduler,
};
