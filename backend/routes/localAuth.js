const express = require('express');
const router = express.Router();

const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const LocalUser = require('../models/localUser');
const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  "https://blissmebel.uz/api";
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
            "Hisob bloklangan",
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
            "Litsenziya bloklangan",
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
            "Litsenziya muddati tugagan",
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
          "Litsenziya tasdiqlanmadi",
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
          "Serverdan litsenziya maʼlumotlari noto‘g‘ri keldi",
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
          "Litsenziya muddati noto‘g‘ri",
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
          "Litsenziya muddati tugagan",
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
          "Litsenziya faol emas",
      };
    }

    // ========================================================
    // EVERYTHING OK
    // ========================================================

    console.log(
      "[LICENSE] ACTIVE - access allowed"
    );

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
        "Litsenziya maʼlumoti topilmadi",
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
        "Litsenziya muddati noto‘g‘ri",
    };
  }

  if (
    expiresAt.getTime() <=
    Date.now()
  ) {
    return {
      allowed: false,

      online: false,

      code:
        "LICENSE_EXPIRED",

      message:
        "Litsenziya muddati tugagan",
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
        "Litsenziya bloklangan",
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
        "Litsenziya faol emas",
    };
  }

  // ----------------------------------------------------------
  // OFFLINE ACCESS
  // ----------------------------------------------------------

  console.log(
    "[LICENSE] OFFLINE ACTIVE - access allowed"
  );

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
      owner,
      license,
    } = req.body;

    if (!/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        message:
          "PIN aynan 4 xonali son bo'lishi kerak",
      });
    }

    if (
      !owner?.id ||
      !owner?.companyName ||
      !owner?.username
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Owner ma'lumotlari to'liq emas",
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
          "License ma'lumotlari to'liq emas",
      });
    }

    if (license.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "License faol emas",
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
          "License muddati tugagan",
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
    message: "JWT_SECRET sozlanmagan",
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
  message: "PIN lokal bazaga saqlandi",

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
        message: 'PIN kod kiriting',
      });
    }

    // ========================================================
    // 2. PIN 4 XONALI SONMI?
    // ========================================================

    if (!/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        code: 'PIN_INVALID_FORMAT',
        message: 'PIN aynan 4 xonali son bo‘lishi kerak',
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
        message: 'Lokal foydalanuvchi topilmadi',
      });
    }

    // ========================================================
    // 4. PIN HASH BORMI?
    // ========================================================

    if (!localUser.pinHash) {
      return res.status(403).json({
        success: false,
        code: 'PIN_NOT_CONFIGURED',
        message: 'PIN kod hali yaratilmagan',
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
        message: 'PIN kod noto‘g‘ri',
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
          'Litsenziyadan foydalanishga ruxsat yo‘q',
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
        'JWT_SECRET backend/.env ichida topilmadi'
      );

      return res.status(500).json({
        success: false,
        code: 'JWT_SECRET_NOT_CONFIGURED',
        message:
          'Lokal autentifikatsiya sozlanmagan',
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
      message: 'Tizimga muvaffaqiyatli kirildi',

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
router.get('/check-license', async (req, res) => {
  try {
    const localUser = await LocalUser.findOne();

    if (!localUser) {
      return res.status(404).json({
        success: false,
        initialized: false,
        message: 'Lokal foydalanuvchi topilmadi',
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