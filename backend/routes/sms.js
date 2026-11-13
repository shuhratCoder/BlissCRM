const express = require("express");

const router =
  express.Router();

const SmsSetting =
  require("../models/smsSetting");

const authMiddleware =
  require("../middlewares/authorization");

const {
  encryptPassword,
  decryptPassword,

  testCredentials,
  getBalance,
  sendBatchSms,
} = require("../services/eskizService");

const {
  normalizeBaseUrl,
  testAndroidGateway,
  sendAndroidSms,
} = require("../services/androidSmsService");

const {
  DEFAULT_ORDER_TEMPLATE,
  clampReminderDays,
} = require("../services/autoSms");

const DEFAULT_TEMPLATE =
  "Ассалому алайкум, {name}! Сизнинг қарзингиз: {duty} сўм.";

// ============================================================
// HELPER
// ============================================================

function normalizeProvider(value) {
  return value === "android"
    ? "android"
    : "eskiz";
}

async function getOrCreateSettings() {
  let settings =
    await SmsSetting.findByPk(1);

  if (!settings) {
    settings =
      await SmsSetting.create({
        id: 1,

        eskizLogin: "",

        eskizPassword: "",

        smsTemplate:
          DEFAULT_TEMPLATE,
      });
  }

  // Эски лотинча стандарт шаблон кирилл вариантига алмаштирилади
  if (
    settings.smsTemplate ===
    "Assalomu alaykum, {name}! Sizning qarzingiz: {duty} so'm."
  ) {
    settings.smsTemplate =
      DEFAULT_TEMPLATE;

    await settings.save();
  }

  return settings;
}

// Frontend учун созламалар. "eskizLogin" / "hasPassword" —
// танланган усулнинг логини ва пароли борлиги (эски номлар сақланган).
function serializeSettings(settings) {
  const provider =
    normalizeProvider(
      settings.provider
    );

  const logins = {
    eskiz:
      settings.eskizLogin || "",
    android:
      settings.androidLogin || "",
  };

  const hasPasswords = {
    eskiz: Boolean(
      settings.eskizPassword
    ),
    android: Boolean(
      settings.androidPassword
    ),
  };

  return {
    provider,

    eskizLogin:
      logins[provider],

    hasPassword:
      hasPasswords[provider],

    androidUrl:
      settings.androidUrl || "",

    logins,
    hasPasswords,

    smsTemplate:
      settings.smsTemplate,

    // Автоматик СМС
    orderSmsEnabled: Boolean(
      settings.orderSmsEnabled
    ),

    orderSmsTemplate:
      settings.orderSmsTemplate ||
      DEFAULT_ORDER_TEMPLATE,

    reminderEnabled: Boolean(
      settings.reminderEnabled
    ),

    reminderDays:
      clampReminderDays(
        settings.reminderDays
      ),
  };
}

// Танланган усул тўлиқ созланганми?
function isConfigured(settings) {
  if (
    normalizeProvider(
      settings.provider
    ) === "android"
  ) {
    return Boolean(
      settings.androidUrl &&
        settings.androidLogin &&
        settings.androidPassword
    );
  }

  return Boolean(
    settings.eskizLogin &&
      settings.eskizPassword
  );
}

// ============================================================
// GET SETTINGS
// ============================================================

router.get(
  "/sms/settings",
  authMiddleware,
  async (req, res) => {
    try {
      const settings =
        await getOrCreateSettings();

      return res.json({
        success: true,

        settings:
          serializeSettings(
            settings
          ),
      });
    } catch (error) {
      console.error(
        "GET SMS SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "СМС созламаларини олишда хатолик",
      });
    }
  }
);

// ============================================================
// SAVE SETTINGS
// ============================================================

router.put(
  "/sms/settings",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        eskizLogin,
        eskizPassword,
        smsTemplate,
        androidUrl,
      } = req.body;

      const provider =
        normalizeProvider(
          req.body.provider
        );

      if (
        typeof eskizLogin !==
          "string" ||
        !eskizLogin.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            provider === "android"
              ? "Телефондаги логин киритилиши керак"
              : "Эскиз логин киритилиши керак",
        });
      }

      if (
        typeof smsTemplate !==
          "string" ||
        !smsTemplate.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "СМС матни киритилиши керак",
        });
      }

      const settings =
        await getOrCreateSettings();

      const updateData = {
        provider,

        smsTemplate:
          smsTemplate.trim(),
      };

      // ------------------------------------------------------
      // АВТОМАТИК СМС (юборилган майдонларгина ўзгаради)
      // ------------------------------------------------------

      if (
        typeof req.body.orderSmsEnabled ===
        "boolean"
      ) {
        updateData.orderSmsEnabled =
          req.body.orderSmsEnabled;
      }

      if (
        typeof req.body.orderSmsTemplate ===
        "string"
      ) {
        updateData.orderSmsTemplate =
          req.body.orderSmsTemplate.trim();
      }

      if (
        updateData.orderSmsEnabled &&
        !(
          updateData.orderSmsTemplate ??
          settings.orderSmsTemplate ??
          DEFAULT_ORDER_TEMPLATE
        )
      ) {
        updateData.orderSmsTemplate =
          DEFAULT_ORDER_TEMPLATE;
      }

      if (
        req.body.reminderDays !==
        undefined
      ) {
        updateData.reminderDays =
          clampReminderDays(
            req.body.reminderDays
          );
      }

      if (
        typeof req.body.reminderEnabled ===
        "boolean"
      ) {
        updateData.reminderEnabled =
          req.body.reminderEnabled;

        // Ёқилган пайт: шу вақтгача СМС олмаган мижозлар учун саноқ боши
        if (
          req.body.reminderEnabled &&
          !settings.reminderEnabled
        ) {
          updateData.reminderStartedAt =
            new Date();
        }
      }

      const newPassword =
        typeof eskizPassword ===
          "string" &&
        eskizPassword.trim()
          ? encryptPassword(
              eskizPassword.trim()
            )
          : null;

      if (provider === "android") {
        try {
          updateData.androidUrl =
            normalizeBaseUrl(
              androidUrl
            );
        } catch (urlError) {
          return res.status(400).json({
            success: false,
            message:
              urlError.message,
          });
        }

        updateData.androidLogin =
          eskizLogin.trim();

        // Password bo'sh yuborilsa,
        // eski password saqlanib qoladi.
        if (newPassword) {
          updateData.androidPassword =
            newPassword;
        }
      } else {
        updateData.eskizLogin =
          eskizLogin.trim();

        if (newPassword) {
          updateData.eskizPassword =
            newPassword;
        }
      }

      await settings.update(
        updateData
      );

      return res.json({
        success: true,

        message:
          "СМС созламалари сақланди",

        settings:
          serializeSettings(
            settings
          ),
      });
    } catch (error) {
      console.error(
        "SAVE SMS SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "СМС созламаларини сақлашда хатолик",
      });
    }
  }
);

// ============================================================
// TEST CONNECTION (ESKIZ / ANDROID)
// ============================================================

router.post(
  "/sms/test",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        eskizLogin,
        eskizPassword,
        androidUrl,
      } = req.body;

      const settings =
        await getOrCreateSettings();

      const provider =
        normalizeProvider(
          req.body.provider ||
            settings.provider
        );

      const isAndroid =
        provider === "android";

      const savedLogin =
        isAndroid
          ? settings.androidLogin
          : settings.eskizLogin;

      const savedPassword =
        isAndroid
          ? settings.androidPassword
          : settings.eskizPassword;

      const login =
        String(
          eskizLogin ||
            savedLogin ||
            ""
        ).trim();

      let password =
        String(
          eskizPassword ||
            ""
        ).trim();

      // Agar frontend yangi parol yubormasa,
      // SQLite'dagi saqlangan paroldan foydalanamiz.
      if (
        !password &&
        savedPassword
      ) {
        password =
          decryptPassword(
            savedPassword
          );
      }

      if (!login) {
        return res.status(400).json({
          success: false,
          message: isAndroid
            ? "Телефондаги логин киритилмаган"
            : "Эскиз логин киритилмаган",
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message: isAndroid
            ? "Телефондаги парол киритилмаган"
            : "Эскиз пароли киритилмаган",
        });
      }

      if (isAndroid) {
        await testAndroidGateway({
          url:
            androidUrl ||
            settings.androidUrl,
          login,
          password,
        });

        return res.json({
          success: true,
          message:
            "Телефон муваффақиятли уланди",
        });
      }

      await testCredentials(
        login,
        password
      );

      return res.json({
        success: true,
        message:
          "Эскиз аккаунти муваффақиятли уланди",
      });
    } catch (error) {
      console.error(
        "TEST SMS PROVIDER ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Уланишни текширишда хатолик",
      });
    }
  }
);

// ============================================================
// BALANCE / CONNECTION STATUS
// ============================================================

router.get(
  "/sms/balance",
  authMiddleware,
  async (req, res) => {
    try {
      const settings =
        await getOrCreateSettings();

      if (!isConfigured(settings)) {
        return res.status(400).json({
          success: false,
          message:
            "Аввал СМС юбориш усулини созланг",
        });
      }

      // Android телефонда баланс йўқ: фақат уланиш текширилади.
      if (
        normalizeProvider(
          settings.provider
        ) === "android"
      ) {
        await testAndroidGateway({
          url: settings.androidUrl,
          login:
            settings.androidLogin,
          password:
            decryptPassword(
              settings.androidPassword
            ),
        });

        return res.json({
          success: true,
          provider: "android",
          balance: null,
        });
      }

      const password =
        decryptPassword(
          settings.eskizPassword
        );

      const balance =
        await getBalance(
          settings.eskizLogin,
          password
        );

      return res.json({
        success: true,
        provider: "eskiz",
        balance,
      });
    } catch (error) {
      console.error(
        "GET SMS BALANCE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "СМС балансини олишда хатолик",
      });
    }
  }
);

// ============================================================
// SEND SMS
// ============================================================

router.post(
  "/sms/send",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        messages,
      } = req.body;

      if (
        !Array.isArray(messages) ||
        messages.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "СМС юбориладиган мижозлар топилмади",
        });
      }

      const settings =
        await getOrCreateSettings();

      const provider =
        normalizeProvider(
          settings.provider
        );

      if (!isConfigured(settings)) {
        return res.status(400).json({
          success: false,
          code:
            provider === "android"
              ? "ANDROID_NOT_CONFIGURED"
              : "ESKIZ_NOT_CONFIGURED",
          message:
            provider === "android"
              ? "Аввал телефон манзили, логин ва паролини созланг"
              : "Аввал Эскиз аккаунтини созланг",
        });
      }

      // --------------------------------------------------------
      // VALIDATE MESSAGES
      // --------------------------------------------------------

      const normalizedMessages =
        messages.map(
          (message, index) => {
            if (
              !message ||
              !message.to ||
              !message.text
            ) {
              throw new Error(
                `${index + 1}-СМС маълумотлари нотўғри`
              );
            }

            const phone =
              String(
                message.to
              ).replace(
                /\D/g,
                ""
              );

            if (
              phone.length !==
              12 ||
              !phone.startsWith(
                "998"
              )
            ) {
              throw new Error(
                `${index + 1}-мижоз телефон рақами нотўғри`
              );
            }

            return {
              user_sms_id:
                String(
                  message.user_sms_id ||
                    `sms${Date.now()}${index}`
                ),

              to: Number(phone),

              text:
                String(
                  message.text
                ).trim(),
            };
          }
        );

      // --------------------------------------------------------
      // SEND: ANDROID
      // --------------------------------------------------------

      if (provider === "android") {
        const result =
          await sendAndroidSms({
            url: settings.androidUrl,
            login:
              settings.androidLogin,
            password:
              decryptPassword(
                settings.androidPassword
              ),
            messages:
              normalizedMessages,
          });

        if (result.sent === 0) {
          const firstError =
            result.results.find(
              (item) => !item.ok
            );

          return res.status(400).json({
            success: false,
            message:
              firstError?.error ||
              "СМС юборишда хатолик",
            result,
          });
        }

        return res.json({
          success: true,
          provider: "android",

          message:
            result.failed > 0
              ? `${result.sent} та СМС телефонга юборилди, ${result.failed} таси юборилмади`
              : `${result.sent} та СМС телефонга юборилди`,

          sent: result.sent,
          failed: result.failed,

          result,
        });
      }

      // --------------------------------------------------------
      // SEND: ESKIZ
      // --------------------------------------------------------

      const result =
        await sendBatchSms({
          email:
            settings.eskizLogin,

          password:
            decryptPassword(
              settings.eskizPassword
            ),

          messages:
            normalizedMessages,
        });

      return res.json({
        success: true,
        provider: "eskiz",

        message:
          "СМС юбориш сўрови Эскизга юборилди",

        sent:
          normalizedMessages.length,
        failed: 0,

        result,
      });
    } catch (error) {
      console.error(
        "SEND SMS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "СМС юборишда хатолик",
      });
    }
  }
);

// ============================================================
// DELETE / RESET SETTINGS
// ============================================================

router.delete(
  "/sms/settings",
  authMiddleware,
  async (req, res) => {
    try {
      const settings =
        await SmsSetting.findByPk(1);

      if (settings) {
        await settings.update({
          provider: "eskiz",

          eskizLogin: "",

          eskizPassword: "",

          androidUrl: "",

          androidLogin: "",

          androidPassword: "",

          orderSmsEnabled: false,

          orderSmsTemplate: "",

          reminderEnabled: false,

          reminderDays: 7,

          reminderStartedAt: null,

          smsTemplate:
            DEFAULT_TEMPLATE,
        });
      }

      return res.json({
        success: true,
        message:
          "СМС созламалари тозаланди",
      });
    } catch (error) {
      console.error(
        "RESET SMS SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "СМС созламаларини тозалашда хатолик",
      });
    }
  }
);

module.exports = router;
