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

// ============================================================
// HELPER
// ============================================================

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
          "Assalomu alaykum, {name}! Sizning qarzingiz: {duty} so'm.",
      });
  }

  return settings;
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

        settings: {
          eskizLogin:
            settings.eskizLogin,

          hasPassword:
            Boolean(
              settings.eskizPassword
            ),

          smsTemplate:
            settings.smsTemplate,
        },
      });
    } catch (error) {
      console.error(
        "GET SMS SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "SMS sozlamalarini olishda xatolik",
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
      } = req.body;

      if (
        typeof eskizLogin !==
          "string" ||
        !eskizLogin.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Eskiz login kiritilishi kerak",
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
            "SMS matni kiritilishi kerak",
        });
      }

      const settings =
        await getOrCreateSettings();

      const updateData = {
        eskizLogin:
          eskizLogin.trim(),

        smsTemplate:
          smsTemplate.trim(),
      };

      // Password bo'sh yuborilsa,
      // eski password saqlanib qoladi.
      if (
        typeof eskizPassword ===
          "string" &&
        eskizPassword.trim()
      ) {
        updateData.eskizPassword =
          encryptPassword(
            eskizPassword.trim()
          );
      }

      await settings.update(
        updateData
      );

      return res.json({
        success: true,

        message:
          "SMS sozlamalari saqlandi",

        settings: {
          eskizLogin:
            settings.eskizLogin,

          hasPassword:
            Boolean(
              settings.eskizPassword
            ),

          smsTemplate:
            settings.smsTemplate,
        },
      });
    } catch (error) {
      console.error(
        "SAVE SMS SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "SMS sozlamalarini saqlashda xatolik",
      });
    }
  }
);

// ============================================================
// TEST ESKIZ
// ============================================================

router.post(
  "/sms/test",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        eskizLogin,
        eskizPassword,
      } = req.body;

      const settings =
        await getOrCreateSettings();

      const login =
        String(
          eskizLogin ||
            settings.eskizLogin ||
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
        settings.eskizPassword
      ) {
        password =
          decryptPassword(
            settings.eskizPassword
          );
      }

      if (!login) {
        return res.status(400).json({
          success: false,
          message:
            "Eskiz login kiritilmagan",
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message:
            "Eskiz paroli kiritilmagan",
        });
      }

      await testCredentials(
        login,
        password
      );

      return res.json({
        success: true,
        message:
          "Eskiz akkaunti muvaffaqiyatli ulandi",
      });
    } catch (error) {
      console.error(
        "TEST ESKIZ ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Eskiz akkauntini tekshirishda xatolik",
      });
    }
  }
);

// ============================================================
// BALANCE
// ============================================================

router.get(
  "/sms/balance",
  authMiddleware,
  async (req, res) => {
    try {
      const settings =
        await getOrCreateSettings();

      if (
        !settings.eskizLogin ||
        !settings.eskizPassword
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Avval Eskiz akkauntini sozlang",
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
          "SMS balansini olishda xatolik",
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
            "SMS yuboriladigan mijozlar topilmadi",
        });
      }

      const settings =
        await getOrCreateSettings();

      if (
        !settings.eskizLogin ||
        !settings.eskizPassword
      ) {
        return res.status(400).json({
          success: false,
          code:
            "ESKIZ_NOT_CONFIGURED",
          message:
            "Avval Eskiz akkauntini sozlang",
        });
      }

      const password =
        decryptPassword(
          settings.eskizPassword
        );

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
                `${index + 1}-SMS ma'lumotlari noto'g'ri`
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
                `${index + 1}-mijoz telefon raqami noto'g'ri`
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
      // SEND
      // --------------------------------------------------------

      const result =
        await sendBatchSms({
          email:
            settings.eskizLogin,

          password,

          messages:
            normalizedMessages,
        });

      return res.json({
        success: true,

        message:
          "SMS yuborish so'rovi Eskizga yuborildi",

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
          "SMS yuborishda xatolik",
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
          eskizLogin: "",

          eskizPassword: "",

          smsTemplate:
            "Assalomu alaykum, {name}! Sizning qarzingiz: {duty} so'm.",
        });
      }

      return res.json({
        success: true,
        message:
          "SMS sozlamalari tozalandi",
      });
    } catch (error) {
      console.error(
        "RESET SMS SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "SMS sozlamalarini tozalashda xatolik",
      });
    }
  }
);

module.exports = router;