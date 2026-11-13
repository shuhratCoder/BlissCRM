const express = require('express');
const router = express.Router();

const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const LocalUser = require('../models/localUser');
const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  "https://blissmebel.uz/api";
const authMiddleware =
  require("../middlewares/authorization");

const {
  CLOCK_TOLERANCE_MS,
  touchLastSeen,
} = require("../services/licenseClock");

// Локал сессия токени (12 соат)
function signSession(localUser) {
  return jwt.sign(
    {
      localUserId: localUser.id,
      ownerId: localUser.ownerId,
      username: localUser.username,
      companyName: localUser.companyName,
      type: "local-session",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "12h",
    }
  );
}

async function verifyLocalLicense(localUser) {
  // ==========================================================
  // ADMIN CRM API
  // ==========================================================

  const adminApiUrl =
    process.env.ADMIN_API_URL ||
    "https://blissmebel.uz/api";

  const verifyUrl =
    `${adminApiUrl}/auth/verify-license`;

  console.log(
    "[LICENSE] Checking Admin CRM..."
  );

  console.log(
    "[LICENSE] URL:",
    verifyUrl
  );

  console.log(
    "[LICENSE] Owner ID:",
    localUser.ownerId
  );

  console.log(
    "[LICENSE] License ID:",
    localUser.licenseId
  );

  // ==========================================================
  // 1. ONLINE CHECK
  // ==========================================================

  try {
    const response =
      await fetch(
        verifyUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            ownerId:
              localUser.ownerId,

            licenseId:
              localUser.licenseId,
          }),

          signal:
            AbortSignal.timeout(
              5000
            ),
        }
      );

    let result = {};

    try {
      result =
        await response.json();
    } catch (jsonError) {
      console.error(
        "[LICENSE] Invalid JSON response:",
        jsonError.message
      );
    }

    console.log(
      "[LICENSE] Admin response status:",
      response.status
    );

    console.log(
      "[LICENSE] Admin response:",
      result
    );

    // ========================================================
    // SERVER JAVOBI KELDI
    //
    // MUHIM:
    // Agar server javob bergan bo'lsa, offline fallback
    // QILMAYMIZ.
    //
    // OWNER_BLOCKED
    // LICENSE_BLOCKED
    // LICENSE_EXPIRED
    // LICENSE_INACTIVE
    //
    // barchasi loginni to'xtatadi.
    // ========================================================

    // ========================================================
    // VAQTINCHALIK SERVER XATOSI
    //
    // 5xx (masalan deploy paytidagi 502), 429 yoki kodsiz
    // xato javobi litsenziya rad etilgani emas. Bunday holda
    // lokal statusni buzmaymiz va offline tekshiruvga o'tamiz.
    // ========================================================

    const isTransientError =
      response.status >= 500 ||
      response.status === 429 ||
      (!response.ok && !result.code);

    if (isTransientError) {
      throw new Error(
        `Admin API vaqtincha javob bermadi (HTTP ${response.status})`
      );
    }

    if (
      !response.ok ||
      result.success === false
    ) {
      const code =
        result.code ||
        "LICENSE_REJECTED";

      console.warn(
        "[LICENSE] REJECTED:",
        code
      );

      // ------------------------------------------------------
      // OWNER BLOCKED
      // ------------------------------------------------------

      if (
        code === "OWNER_BLOCKED"
      ) {
        await localUser.update({
          licenseStatus:
            "blocked",
        });

        return {
          allowed: false,

          online: true,

          code:
            "OWNER_BLOCKED",

          message:
            result.message ||
            "Ҳисоб блокланган",
        };
      }

      // ------------------------------------------------------
      // LICENSE BLOCKED
      // ------------------------------------------------------

      if (
        code === "LICENSE_BLOCKED"
      ) {
        await localUser.update({
          licenseStatus:
            "blocked",
        });

        return {
          allowed: false,

          online: true,

          code:
            "LICENSE_BLOCKED",

          message:
            result.message ||
            "Лицензия блокланган",
        };
      }

      // ------------------------------------------------------
      // LICENSE EXPIRED
      // ------------------------------------------------------

      if (
        code === "LICENSE_EXPIRED"
      ) {
        await localUser.update({
          licenseStatus:
            "expired",
        });

        return {
          allowed: false,

          online: true,

          code:
            "LICENSE_EXPIRED",

          message:
            result.message ||
            "Лицензия муддати тугаган",
        };
      }

      // ------------------------------------------------------
      // OTHER REJECTED
      // ------------------------------------------------------

      await localUser.update({
        licenseStatus:
          "inactive",
      });

      return {
        allowed: false,

        online: true,

        code,

        message:
          result.message ||
          "Лицензия тасдиқланмади",
      };
    }

    // ========================================================
    // SERVER SUCCESS
    // ========================================================

    if (
      !result.owner ||
      !result.license
    ) {
      console.error(
        "[LICENSE] Invalid successful response"
      );

      return {
        allowed: false,

        online: true,

        code:
          "INVALID_LICENSE_RESPONSE",

        message:
          "Сервердан лицензия маълумотлари нотўғри келди",
      };
    }

    // ========================================================
    // LOCAL CACHE UPDATE
    // ========================================================

    await localUser.update({
      companyName:
        result.owner.companyName,

      username:
        result.owner.username,

      licenseStartsAt:
        result.license.startsAt,

      licenseExpiresAt:
        result.license.expiresAt,

      licenseStatus:
        result.license.status,
    });

    // ========================================================
    // EXPIRATION CHECK
    // ========================================================

    const expiresAt =
      new Date(
        result.license.expiresAt
      );

    if (
      Number.isNaN(
        expiresAt.getTime()
      )
    ) {
      await localUser.update({
        licenseStatus:
          "expired",
      });

      return {
        allowed: false,

        online: true,

        code:
          "LICENSE_EXPIRED",

        message:
          "Лицензия муддати нотўғри",
      };
    }

    if (
      expiresAt.getTime() <=
      Date.now()
    ) {
      await localUser.update({
        licenseStatus:
          "expired",
      });

      return {
        allowed: false,

        online: true,

        code:
          "LICENSE_EXPIRED",

        message:
          "Лицензия муддати тугаган",
      };
    }

    // ========================================================
    // LICENSE STATUS
    // ========================================================

    if (
      result.license.status !==
      "active"
    ) {
      await localUser.update({
        licenseStatus:
          result.license.status ||
          "inactive",
      });

      return {
        allowed: false,

        online: true,

        code:
          "LICENSE_INACTIVE",

        message:
          "Лицензия фаол эмас",
      };
    }

    // ========================================================
    // EVERYTHING OK
    // ========================================================

    console.log(
      "[LICENSE] ACTIVE - access allowed"
    );

    // Сервер тасдиқлади: соат белгиси ҳозирги вақтга қайта ўрнатилади
    await touchLastSeen(localUser, {
      reset: true,
    });

    return {
      allowed: true,

      online: true,

      license:
        result.license,
    };
  } catch (onlineError) {
    // ========================================================
    // FAQAT HAQIQIY NETWORK ERROR
    //
    // Serverdan 403/401/500 kelgan holat bu yerga
    // kelmaydi. Ular yuqoridagi response orqali ishlanadi.
    // ========================================================

    console.error(
      "[LICENSE] Admin API connection error:",
      onlineError
    );

    console.warn(
      "[LICENSE] Switching to OFFLINE mode"
    );
  }

  // ==========================================================
  // 2. OFFLINE LICENSE
  //
  // Bu qism faqat Admin API'ga umuman ulanib bo'lmaganda
  // ishlaydi.
  // ==========================================================

  console.log(
    "[LICENSE] OFFLINE CHECK"
  );

  // ----------------------------------------------------------
  // LICENSE DATA EXISTS?
  // ----------------------------------------------------------

  if (
    !localUser.licenseExpiresAt
  ) {
    return {
      allowed: false,

      online: false,

      code:
        "LICENSE_NOT_FOUND",

      message:
        "Лицензия маълумоти топилмади",
    };
  }

  // ----------------------------------------------------------
  // EXPIRATION
  // ----------------------------------------------------------

  const expiresAt =
    new Date(
      localUser.licenseExpiresAt
    );

  if (
    Number.isNaN(
      expiresAt.getTime()
    )
  ) {
    return {
      allowed: false,

      online: false,

      code:
        "LICENSE_EXPIRED",

      message:
        "Лицензия муддати нотўғри",
    };
  }

  // ----------------------------------------------------------
  // СОАТ ОРҚАГА СУРИЛГАНМИ?
  //
  // Дастур охирги марта ишлаган вақт сақланади. Компьютер соати
  // ундан орқада бўлса, лицензия муддатини алдаш мумкин бўлади,
  // шунинг учун интернетсиз киришга рухсат берилмайди.
  // ----------------------------------------------------------

  const lastSeen =
    localUser.lastSeenAt
      ? new Date(
          localUser.lastSeenAt
        ).getTime()
      : 0;

  if (
    lastSeen &&
    Date.now() + CLOCK_TOLERANCE_MS <
      lastSeen
  ) {
    console.warn(
      "[LICENSE] Clock moved backwards"
    );

    return {
      allowed: false,

      online: false,

      code:
        "CLOCK_TAMPERED",

      message:
        "Компьютер соати орқага сурилган. Соатни тўғриланг ёки интернетга уланиб, қайта уриниб кўринг.",
    };
  }

  if (
    expiresAt.getTime() <=
    Math.max(Date.now(), lastSeen)
  ) {
    return {
      allowed: false,

      online: false,

      code:
        "LICENSE_EXPIRED",

      message:
        "Лицензия муддати тугаган. Узайтирилган бўлса, интернетга уланиб қайта уриниб кўринг.",
    };
  }

  // ----------------------------------------------------------
  // BLOCKED / INACTIVE
  //
  // Lokal bazada ham blocked bo'lsa, offline rejimda ham
  // login berilmaydi.
  // ----------------------------------------------------------

  if (
    localUser.licenseStatus ===
      "blocked"
  ) {
    return {
      allowed: false,

      online: false,

      code:
        "LICENSE_BLOCKED",

      message:
        "Лицензия блокланган",
    };
  }

  if (
    localUser.licenseStatus !==
    "active"
  ) {
    return {
      allowed: false,

      online: false,

      code:
        "LICENSE_INACTIVE",

      message:
        "Лицензия фаол эмас",
    };
  }

  // ----------------------------------------------------------
  // OFFLINE ACCESS
  // ----------------------------------------------------------

  console.log(
    "[LICENSE] OFFLINE ACTIVE - access allowed"
  );

  await touchLastSeen(localUser);

  return {
    allowed: true,

    online: false,

    license: {
      id:
        localUser.licenseId,

      startsAt:
        localUser.licenseStartsAt,

      expiresAt:
        localUser.licenseExpiresAt,

      status:
        localUser.licenseStatus,
    },
  };
}
// ============================================================
// 1. LOCAL USER BORMI?
// Login page ochilganda tekshiriladi
// ============================================================

router.get("/local-status", async (req, res) => {
  try {
    const localUser = await LocalUser.findOne();

    if (!localUser) {
      return res.status(200).json({
        success: true,
        initialized: false,
      });
    }

    const now = new Date();
    const expiresAt = new Date(
      localUser.licenseExpiresAt
    );

    const licenseExpired =
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= now;

    return res.status(200).json({
      success: true,

      initialized: true,

      user: {
        id: localUser.id,
        ownerId: localUser.ownerId,
        companyName: localUser.companyName,
        username: localUser.username,
      },

      license: {
        id: localUser.licenseId,
        startsAt: localUser.licenseStartsAt,
        expiresAt: localUser.licenseExpiresAt,
        status: localUser.licenseStatus,
        expired: licenseExpired,
      },
    });

  } catch (error) {
    console.error(
      "LOCAL STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// ============================================================
// 2. BIRINCHI MARTA PIN YARATISH
// ============================================================

router.post("/setup-pin", async (req, res) => {
  try {
    const {
      pin,
      owner: clientOwner,
      license: clientLicense,
      backupToken: clientBackupToken,
    } = req.body;

    if (!/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        message:
          "ПИН айнан 4 хонали сон бўлиши керак",
      });
    }

    // Lokal foydalanuvchi allaqachon sozlangan bo'lsa, PIN ni
    // eski PIN siz qayta yozib bo'lmaydi.
    const existingUser =
      await LocalUser.findOne();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: "ALREADY_INITIALIZED",
        message:
          "Дастур аллақачон созланган. ПИН код билан киринг.",
      });
    }

    if (
      !clientOwner?.id ||
      !clientLicense?.id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Эга ёки лицензия маълумотлари тўлиқ эмас",
      });
    }

    // Client yuborgan ma'lumotga ishonmaymiz: owner va license
    // Admin serverdan qayta olinadi va faqat o'sha saqlanadi.
    let verified;

    try {
      const response = await fetch(
        `${
          process.env.ADMIN_API_URL ||
          ADMIN_API_URL
        }/auth/verify-license`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ownerId: clientOwner.id,
            licenseId: clientLicense.id,
          }),
          signal:
            AbortSignal.timeout(8000),
        }
      );

      verified = {
        ok: response.ok,
        result: await response
          .json()
          .catch(() => ({})),
      };
    } catch (networkError) {
      console.error(
        "SETUP PIN LICENSE CHECK ERROR:",
        networkError
      );

      return res.status(503).json({
        success: false,
        code: "ADMIN_UNREACHABLE",
        message:
          "Лицензия серверига уланиб бўлмади. Интернетни текшириб, қайта уриниб кўринг.",
      });
    }

    if (
      !verified.ok ||
      verified.result.success === false ||
      !verified.result.owner ||
      !verified.result.license
    ) {
      return res.status(403).json({
        success: false,
        code:
          verified.result.code ||
          "LICENSE_REJECTED",
        message:
          verified.result.message ||
          "Лицензия тасдиқланмади",
      });
    }

    const owner = verified.result.owner;
    const license = verified.result.license;

    if (
      !owner?.id ||
      !owner?.companyName ||
      !owner?.username
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Эга маълумотлари тўлиқ эмас",
      });
    }

    if (
      !license?.id ||
      !license?.startsAt ||
      !license?.expiresAt ||
      !license?.status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Лицензия маълумотлари тўлиқ эмас",
      });
    }

    if (license.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Лицензия фаол эмас",
      });
    }

    const expiresAt =
      new Date(license.expiresAt);

    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= new Date()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Лицензия муддати тугаган",
      });
    }

    const pinHash =
      await bcrypt.hash(
        String(pin),
        10
      );

    // Birinchi lokal user
    let localUser =
      await LocalUser.findOne();

    if (!localUser) {
      localUser =
        await LocalUser.create({
          ownerId: owner.id,
          companyName: owner.companyName,
          username: owner.username,

          pinHash,

          licenseId: license.id,
          licenseStartsAt:
            license.startsAt,
          licenseExpiresAt:
            license.expiresAt,
          licenseStatus:
            license.status,

          // Логин пайтида сервер берган захира нусха калити
          backupToken:
            typeof clientBackupToken ===
              "string" &&
            clientBackupToken
              ? clientBackupToken
              : null,
        });
    } else {
      // Agar mavjud bo'lsa PIN yangilanadi
      await localUser.update({
        ownerId: owner.id,
        companyName: owner.companyName,
        username: owner.username,

        pinHash,

        licenseId: license.id,
        licenseStartsAt:
          license.startsAt,
        licenseExpiresAt:
          license.expiresAt,
        licenseStatus:
          license.status,
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  return res.status(500).json({
    success: false,
    code: "JWT_SECRET_NOT_CONFIGURED",
    message: "JWT_SECRET созланмаган",
  });
}

const token = jwt.sign(
  {
    localUserId: localUser.id,
    ownerId: localUser.ownerId,
    username: localUser.username,
    companyName: localUser.companyName,
    type: "local-session",
  },
  JWT_SECRET,
  {
    expiresIn: "12h",
  }
);

return res.status(201).json({
  success: true,
  message: "ПИН локал базага сақланди",

  token,

  user: {
    id: localUser.id,
    ownerId: localUser.ownerId,
    companyName: localUser.companyName,
    username: localUser.username,
  },
});

  } catch (error) {
    console.error(
      "SETUP PIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// 3. KEYINGI KIRISHLAR — FAQAT PIN
// ============================================================

router.post('/login-pin', async (req, res) => {
  try {
    const { pin } = req.body;

    // ========================================================
    // 1. PIN KIRITILGANMI?
    // ========================================================

    if (!pin) {
      return res.status(400).json({
        success: false,
        code: 'PIN_REQUIRED',
        message: 'ПИН код киритинг',
      });
    }

    // ========================================================
    // 2. PIN 4 XONALI SONMI?
    // ========================================================

    if (!/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        code: 'PIN_INVALID_FORMAT',
        message: 'ПИН айнан 4 хонали сон бўлиши керак',
      });
    }

    // ========================================================
    // 3. LOCAL USER TOPISH
    // ========================================================

    const localUser = await LocalUser.findOne();

    if (!localUser) {
      return res.status(404).json({
        success: false,
        code: 'LOCAL_USER_NOT_FOUND',
        message: 'Локал фойдаланувчи топилмади',
      });
    }

    // ========================================================
    // 4. PIN HASH BORMI?
    // ========================================================

    if (!localUser.pinHash) {
      return res.status(403).json({
        success: false,
        code: 'PIN_NOT_CONFIGURED',
        message: 'ПИН код ҳали яратилмаган',
      });
    }

    // ========================================================
    // 5. PIN TEKSHIRISH
    // ========================================================

    const isPinValid = await bcrypt.compare(
      String(pin),
      localUser.pinHash
    );

    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        code: 'PIN_INVALID',
        message: 'ПИН код нотўғри',
      });
    }

    // ========================================================
    // 6. LICENSE TEKSHIRISH
    //
    // Internet bor:
    // ADMIN API orqali real license tekshiriladi.
    //
    // Internet yo'q:
    // SQLite'dagi local license tekshiriladi.
    // ========================================================

    const licenseCheck =
      await verifyLocalLicense(localUser);

    if (!licenseCheck.allowed) {
      return res.status(403).json({
        success: false,
        code:
          licenseCheck.code ||
          'LICENSE_DENIED',
        message:
          licenseCheck.message ||
          'Лицензиядан фойдаланишга рухсат йўқ',
        online: licenseCheck.online,
      });
    }

    // ========================================================
    // 7. JWT SECRET TEKSHIRISH
    // ========================================================

    const JWT_SECRET =
      process.env.JWT_SECRET;

    if (!JWT_SECRET) {
      console.error(
        'JWT_SECRET backend/.env ичида топилмади'
      );

      return res.status(500).json({
        success: false,
        code: 'JWT_SECRET_NOT_CONFIGURED',
        message:
          'Локал аутентификация созланмаган',
      });
    }

    // ========================================================
    // 8. LOCAL CRM TOKEN YARATISH
    // ========================================================

   const token = jwt.sign(
  {
    localUserId: localUser.id,
    ownerId: localUser.ownerId,
    username: localUser.username,
    companyName:
      localUser.companyName,
    type: "local-session",
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "12h",
  }
);
    // ========================================================
    // 9. LOGIN SUCCESS
    // ========================================================

    return res.status(200).json({
      success: true,
      message: 'Тизимга муваффақиятли кирилди',

      token,

      online: licenseCheck.online,

      user: {
        id: localUser.id,
        ownerId: localUser.ownerId,
        username: localUser.username,
        companyName: localUser.companyName,
      },

      license: licenseCheck.license,
    });

  } catch (error) {
    console.error(
      'PIN LOGIN ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: error.message,
    });
  }
}); 
// ============================================================
// 4. ПИН УНУТИЛГАНДА — ЛОГИН ВА ПАРОЛ БИЛАН ТИКЛАШ
//
// Логин/парол Admin CRM серверида текширилади (интернет керак).
// Фақат шу дастур боғланган ҳисоб эгаси ПИНни алмаштира олади.
// ============================================================

router.post("/reset-pin", async (req, res) => {
  try {
    const { username, password, pin } =
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

    if (!/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        code: "PIN_INVALID_FORMAT",
        message:
          "ПИН айнан 4 хонали сон бўлиши керак",
      });
    }

    const localUser =
      await LocalUser.findOne();

    if (!localUser) {
      return res.status(404).json({
        success: false,
        code: "LOCAL_USER_NOT_FOUND",
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
          ADMIN_API_URL
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
      console.error(
        "RESET PIN ADMIN ERROR:",
        networkError.message
      );

      return res.status(503).json({
        success: false,
        code: "ADMIN_UNREACHABLE",
        message:
          "Серверга уланиб бўлмади. ПИНни тиклаш учун интернет керак.",
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

    // Сервернинг вақтинчалик хатоси — логин/парол нотўғри дегани эмас
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
      const code = result.code;

      const message =
        code === "OWNER_BLOCKED"
          ? "Ҳисоб блокланган"
          : code === "LICENSE_NOT_FOUND"
            ? "Лицензия топилмади"
            : code === "LICENSE_INACTIVE" ||
                code === "LICENSE_BLOCKED"
              ? "Лицензия фаол эмас"
              : code === "LICENSE_EXPIRED"
                ? "Лицензия муддати тугаган"
                : "Логин ёки парол нотўғри";

      return res
        .status(
          response.status >= 500
            ? 503
            : 401
        )
        .json({
          success: false,
          code:
            code ||
            "INVALID_CREDENTIALS",
          message,
        });
    }

    // Бошқа ҳисобнинг логини билан бу дастур ПИНини алмаштириб бўлмайди
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

    const updateData = {
      pinHash: await bcrypt.hash(
        String(pin),
        10
      ),
    };

    // Сервердан келган янги лицензия маълумотлари ҳам сақланади
    if (
      result.license?.id &&
      result.license?.expiresAt
    ) {
      updateData.licenseId =
        result.license.id;
      updateData.licenseStartsAt =
        result.license.startsAt;
      updateData.licenseExpiresAt =
        result.license.expiresAt;
      updateData.licenseStatus =
        result.license.status;
    }

    if (result.owner.companyName) {
      updateData.companyName =
        result.owner.companyName;
    }

    if (result.owner.username) {
      updateData.username =
        result.owner.username;
    }

    // Захира нусха калити ҳам янгиланади
    if (result.backupToken) {
      updateData.backupToken =
        result.backupToken;
    }

    await localUser.update(updateData);

    await touchLastSeen(localUser, {
      reset: true,
    });

    return res.status(200).json({
      success: true,
      message: "ПИН код янгиланди",

      token: signSession(localUser),

      user: {
        id: localUser.id,
        ownerId: localUser.ownerId,
        username: localUser.username,
        companyName:
          localUser.companyName,
      },
    });
  } catch (error) {
    console.error(
      "RESET PIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error.message,
    });
  }
});

// ============================================================
// 5. ДАСТУР ИЧИДА ПИННИ ЎЗГАРТИРИШ (жорий ПИН билан)
// ============================================================

router.post(
  "/change-pin",
  authMiddleware,
  async (req, res) => {
    try {
      const { currentPin, newPin } =
        req.body;

      if (
        !/^\d{4}$/.test(
          String(newPin)
        )
      ) {
        return res.status(400).json({
          success: false,
          code: "PIN_INVALID_FORMAT",
          message:
            "Янги ПИН айнан 4 хонали сон бўлиши керак",
        });
      }

      const localUser =
        await LocalUser.findOne();

      if (
        !localUser ||
        !localUser.pinHash
      ) {
        return res.status(404).json({
          success: false,
          code: "LOCAL_USER_NOT_FOUND",
          message:
            "Локал фойдаланувчи топилмади",
        });
      }

      const isCurrentValid =
        await bcrypt.compare(
          String(currentPin || ""),
          localUser.pinHash
        );

      if (!isCurrentValid) {
        return res.status(400).json({
          success: false,
          code: "PIN_INVALID",
          message:
            "Жорий ПИН код нотўғри",
        });
      }

      if (
        String(currentPin) ===
        String(newPin)
      ) {
        return res.status(400).json({
          success: false,
          code: "PIN_SAME",
          message:
            "Янги ПИН жорийсидан фарқ қилиши керак",
        });
      }

      await localUser.update({
        pinHash: await bcrypt.hash(
          String(newPin),
          10
        ),
      });

      return res.json({
        success: true,
        message: "ПИН код ўзгартирилди",
      });
    } catch (error) {
      console.error(
        "CHANGE PIN ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "SERVER_ERROR",
        message: error.message,
      });
    }
  }
);

router.get('/check-license', async (req, res) => {
  try {
    const localUser = await LocalUser.findOne();

    if (!localUser) {
      return res.status(404).json({
        success: false,
        initialized: false,
        message: 'Локал фойдаланувчи топилмади',
      });
    }

    const licenseCheck =
      await verifyLocalLicense(localUser);

    if (!licenseCheck.allowed) {
      return res.status(403).json({
        success: false,
        initialized: true,
        allowed: false,
        online: licenseCheck.online,
        code: licenseCheck.code,
        message: licenseCheck.message,
      });
    }

    return res.json({
      success: true,
      initialized: true,
      allowed: true,
      online: licenseCheck.online,
      license: licenseCheck.license,
    });

  } catch (error) {
    console.error(
      'CHECK LICENSE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
module.exports = router;