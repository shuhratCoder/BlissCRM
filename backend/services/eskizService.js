const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const axios = require("axios");

// ============================================================
// CONFIG
// ============================================================

const dataDir =
  process.env.BLISS_DATA_DIR ||
  path.join(__dirname, "..", ".data");

fs.mkdirSync(dataDir, {
  recursive: true,
});

// ============================================================
// ENCRYPTION KEY
//
// Birinchi ishga tushganda yaratiladi.
// Keyingi ishga tushishlarda shu key ishlatiladi.
//
// Shuning uchun boshqa kompyuterga database ko'chirilsa,
// passwordni ochish uchun key ham shu dataDir ichida bo'ladi.
// ============================================================

const keyPath = path.join(
  dataDir,
  "sms-secret.key"
);

function getEncryptionKey() {
  if (fs.existsSync(keyPath)) {
    const key = fs
      .readFileSync(keyPath)
      .toString()
      .trim();

    if (key.length === 64) {
      return Buffer.from(key, "hex");
    }
  }

  const key = crypto.randomBytes(32);

  fs.writeFileSync(
    keyPath,
    key.toString("hex"),
    {
      encoding: "utf8",
      mode: 0o600,
    }
  );

  return key;
}

const ENCRYPTION_KEY =
  getEncryptionKey();

const ALGORITHM = "aes-256-gcm";

// ============================================================
// ENCRYPT
// ============================================================

function encryptPassword(password) {
  if (!password) {
    return "";
  }

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      iv
    );

  const encrypted = Buffer.concat([
    cipher.update(
      String(password),
      "utf8"
    ),
    cipher.final(),
  ]);

  const authTag =
    cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

// ============================================================
// DECRYPT
// ============================================================

function decryptPassword(encryptedPassword) {
  if (!encryptedPassword) {
    return "";
  }

  const parts =
    encryptedPassword.split(":");

  if (parts.length !== 3) {
    throw new Error(
      "Eskiz password format noto'g'ri"
    );
  }

  const [
    ivHex,
    authTagHex,
    encryptedHex,
  ] = parts;

  const iv =
    Buffer.from(ivHex, "hex");

  const authTag =
    Buffer.from(authTagHex, "hex");

  const encrypted =
    Buffer.from(
      encryptedHex,
      "hex"
    );

  const decipher =
    crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      iv
    );

  decipher.setAuthTag(authTag);

  const decrypted =
    Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8"
  );
}

// ============================================================
// ESKIZ CONFIG
//
// Hozirgi loyihadagi qiymatlar saqlanadi.
// Keyinchalik kerak bo'lsa settingsga ham chiqarish mumkin.
// ============================================================

const ESKIZ_BASE_URL =
  "https://notify.eskiz.uz/api";

const ESKIZ_FROM =
  "4546";

const ESKIZ_DISPATCH_ID =
  75424;

// ============================================================
// LOGIN
// ============================================================

async function loginToEskiz(
  email,
  password
) {
  if (!email || !password) {
    throw new Error(
      "Eskiz login va parol kiritilmagan"
    );
  }

  const form =
    new FormData();

  form.append(
    "email",
    email
  );

  form.append(
    "password",
    password
  );

  try {
    const response =
      await fetch(
        `${ESKIZ_BASE_URL}/auth/login`,
        {
          method: "POST",
          body: form,
          signal:
            AbortSignal.timeout(
              15000
            ),
        }
      );

    let result = {};

    try {
      result =
        await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
          `Eskiz login xatosi: ${response.status}`
      );
    }

    const token =
      result?.data?.token;

    if (!token) {
      throw new Error(
        "Eskiz token qaytarmadi"
      );
    }

    return {
      token,
      data: result,
    };
  } catch (error) {
    if (
      error.name ===
      "TimeoutError"
    ) {
      throw new Error(
        "Eskiz serveriga ulanish vaqt tugadi"
      );
    }

    throw error;
  }
}

// ============================================================
// TEST CREDENTIALS
// ============================================================

async function testCredentials(
  email,
  password
) {
  const result =
    await loginToEskiz(
      email,
      password
    );

  return {
    success: true,
    token: result.token,
  };
}

// ============================================================
// GET BALANCE
// ============================================================

async function getBalance(
  email,
  password
) {
  const {
    token,
  } = await loginToEskiz(
    email,
    password
  );

  const response =
    await axios.get(
      `${ESKIZ_BASE_URL}/user/get-limit`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        timeout: 15000,
      }
    );

  return (
    response.data?.data
      ?.balance ?? 0
  );
}

// ============================================================
// SEND BATCH SMS
// ============================================================

async function sendBatchSms({
  email,
  password,
  messages,
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("SMS yuborish uchun xabarlar mavjud emas");
  }

  const { token } = await loginToEskiz(email, password);

  const payload = {
    messages,
    from: ESKIZ_FROM,
    dispatch_id: ESKIZ_DISPATCH_ID,
  };

  console.log("========== ESKIZ SMS REQUEST ==========");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
    `${ESKIZ_BASE_URL}/message/sms/send-batch`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  console.log("========== ESKIZ SMS RESPONSE ==========");
  console.log("STATUS:", response.status);
  console.log(
    JSON.stringify(response.data, null, 2)
  );

  return response.data;
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  encryptPassword,
  decryptPassword,

  loginToEskiz,
  testCredentials,
  getBalance,
  sendBatchSms,
};