const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middlewares/authorization");

const LocalUser = require("../models/localUser");

const {
  Client,
  Order,
} = require("../models");

const {
  uploadBackup,
  getServerInfo,
  restoreBackup,
  restoreFromFile,
} = require("../services/cloudBackup");

function fail(res, error, fallbackStatus = 400) {
  const status =
    error.code === "ADMIN_UNREACHABLE"
      ? 503
      : fallbackStatus;

  return res.status(status).json({
    success: false,
    code: error.code || "BACKUP_ERROR",
    message: error.message,
  });
}

// ============================================================
// ҲОЛАТ: уланганми, охирги юбориш, сервердаги нусхалар
// ============================================================

router.get(
  "/cloud-backup/status",
  authMiddleware,
  async (req, res) => {
    try {
      const localUser =
        await LocalUser.findOne();

      if (!localUser) {
        return res.status(404).json({
          success: false,
          message:
            "Локал фойдаланувчи топилмади",
        });
      }

      const [clients, orders] =
        await Promise.all([
          Client.count(),
          Order.count(),
        ]);

      const status = {
        success: true,

        linked: Boolean(localUser.backupToken),

        lastBackupAt: localUser.lastBackupAt,

        lastBackupError:
          localUser.lastBackupError || null,

        local: { clients, orders },

        server: null,

        serverError: null,
      };

      if (status.linked) {
        try {
          const info =
            await getServerInfo(localUser);

          status.server = {
            exists: Boolean(info.exists),
            latest: info.latest || null,
            versions: info.versions || [],
          };
        } catch (error) {
          status.serverError = error.message;

          status.serverErrorCode =
            error.code || null;
        }
      }

      return res.json(status);
    } catch (error) {
      console.error(
        "CLOUD BACKUP STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================
// УЛАШ: логин ва парол Admin CRM'да текширилади ва захира нусха
// учун узоқ муддатли калит олинади.
// ============================================================

router.post(
  "/cloud-backup/link",
  authMiddleware,
  async (req, res) => {
    try {
      const { username, password } =
        req.body;

      if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Логин ва паролни киритинг",
        });
      }

      const localUser =
        await LocalUser.findOne();

      if (!localUser) {
        return res.status(404).json({
          success: false,
          message:
            "Локал фойдаланувчи топилмади",
        });
      }

      let response;
      let result = {};

      try {
        response = await fetch(
          `${
            process.env.ADMIN_API_URL ||
            "https://blissmebel.uz/api"
          }/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              username: username.trim(),
              password,
            }),
            signal:
              AbortSignal.timeout(8000),
          }
        );

        result = await response
          .json()
          .catch(() => ({}));
      } catch (networkError) {
        return res.status(503).json({
          success: false,
          code: "ADMIN_UNREACHABLE",
          message:
            "Серверга уланиб бўлмади. Интернетни текширинг.",
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          success: false,
          code: "TOO_MANY_REQUESTS",
          message:
            "Жуда кўп уриниш. Бироздан сўнг қайта уриниб кўринг.",
        });
      }

      if (response.status >= 500) {
        return res.status(503).json({
          success: false,
          code: "ADMIN_UNREACHABLE",
          message:
            "Серверда вақтинча хатолик. Бироздан сўнг қайта уриниб кўринг.",
        });
      }

      if (
        !response.ok ||
        result.success === false ||
        !result.owner
      ) {
        return res.status(401).json({
          success: false,
          code:
            result.code ||
            "INVALID_CREDENTIALS",
          message:
            result.code === "OWNER_BLOCKED"
              ? "Ҳисоб блокланган"
              : result.code
                ? "Лицензия фаол эмас"
                : "Логин ёки парол нотўғри",
        });
      }

      if (
        String(result.owner.id) !==
        String(localUser.ownerId)
      ) {
        return res.status(403).json({
          success: false,
          code: "OWNER_MISMATCH",
          message:
            "Бу логин ушбу дастурга тегишли эмас",
        });
      }

      if (!result.backupToken) {
        return res.status(502).json({
          success: false,
          code: "BACKUP_NOT_SUPPORTED",
          message:
            "Сервер захира нусхани ҳали қўллаб-қувватламайди (сервер янгиланмаган)",
        });
      }

      await localUser.update({
        backupToken: result.backupToken,
        lastBackupError: null,
      });

      return res.json({
        success: true,
        message:
          "Захира нусха сервери уланди",
      });
    } catch (error) {
      console.error(
        "CLOUD BACKUP LINK ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================
// ҲОЗИР ЮБОРИШ
// ============================================================

router.post(
  "/cloud-backup/upload",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await uploadBackup({
        force: true,
      });

      if (result.skipped === "not_linked") {
        return res.status(400).json({
          success: false,
          code: "BACKUP_NOT_LINKED",
          message:
            "Аввал захира нусха серверини уланг",
        });
      }

      if (result.skipped === "empty") {
        return res.status(400).json({
          success: false,
          code: "BACKUP_EMPTY",
          message:
            "Юбориш учун маълумот йўқ (мижоз ва буюртмалар бўш)",
        });
      }

      if (result.skipped === "running") {
        return res.status(409).json({
          success: false,
          code: "BACKUP_RUNNING",
          message:
            "Захира нусха ҳозир юборилмоқда",
        });
      }

      return res.json({
        success: true,
        message:
          "Захира нусха серверга юборилди",
        ...result,
      });
    } catch (error) {
      return fail(res, error);
    }
  }
);

// ============================================================
// СЕРВЕРДАН ТИКЛАШ
// ============================================================

router.post(
  "/cloud-backup/restore",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await restoreBackup({
        id: req.body?.id,
      });

      return res.json({
        success: true,
        message:
          "Маълумотлар захира нусхадан тикланди",
        ...result,
      });
    } catch (error) {
      return fail(res, error);
    }
  }
);

// ============================================================
// ФАЙЛДАН ТИКЛАШ
//
// Admin CRM панелидан юклаб олинган .blissbak файли (gzip JSON)
// сўров танаси сифатида юборилади.
// ============================================================

router.post(
  "/cloud-backup/restore-file",
  authMiddleware,
  express.raw({
    type: "application/octet-stream",
    limit: "25mb",
  }),
  async (req, res) => {
    try {
      const result = await restoreFromFile(
        req.body
      );

      return res.json({
        success: true,
        message:
          "Маълумотлар файлдан тикланди",
        ...result,
      });
    } catch (error) {
      return fail(res, error);
    }
  }
);

module.exports = router;
