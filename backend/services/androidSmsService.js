// ============================================================
// ANDROID SMS GATEWAY (SMSGate, Local Server режими)
//
// Телефондаги "SMS Gateway for Android" иловаси локал тармоқда
// HTTP сервер очади. СМС шу телефоннинг SIM-картасидан кетади.
//   POST http://<телефон IP>:8080/message   (Basic auth)
// ============================================================

const axios = require("axios");

const SEND_DELAY_MS = 250;

// "192.168.1.50:8080", "http://192.168.1.50:8080/" ёки
// ".../message" кўринишидаги манзилни бир хил шаклга келтиради.
function normalizeBaseUrl(rawUrl) {
  let url = String(rawUrl || "").trim();

  if (!url) {
    throw new Error("Телефон манзили киритилмаган");
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  url = url.replace(/\/+$/, "").replace(/\/messages?$/i, "");

  let parsed;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error("Телефон манзили нотўғри. Масалан: 192.168.1.50:8080");
  }

  if (!parsed.hostname) {
    throw new Error("Телефон манзили нотўғри. Масалан: 192.168.1.50:8080");
  }

  // Булут режими ("Облачный сервер"): илова "api.sms-gate.app:443" деб
  // кўрсатади. Бу ҳолда HTTPS ва /3rdparty/v1 йўли керак.
  if (/(^|\.)sms-gate\.app$/i.test(parsed.hostname)) {
    return `https://${parsed.hostname}/3rdparty/v1`;
  }

  return url;
}

function describeError(error) {
  const status = error.response?.status;

  if (status === 401 || status === 403) {
    return "Телефондаги логин ёки парол нотўғри";
  }

  if (status) {
    const detail =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "";

    return `Телефон хатолик қайтарди (HTTP ${status})${detail ? `: ${detail}` : ""}`;
  }

  if (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ECONNREFUSED" ||
    error.code === "EHOSTUNREACH" ||
    error.code === "ENETUNREACH" ||
    error.code === "ENOTFOUND" ||
    error.code === "ECONNRESET"
  ) {
    return "Телефонга уланиб бўлмади. Телефон ёқилгани, SMSGate \"Online\" ҳолатда экани ва компьютер билан бир Wi-Fi тармоғида экани (булут режимида — интернет борлиги) текширинг";
  }

  return error.message || "Телефонга уланишда хатолик";
}

// ============================================================
// TEST
// ============================================================

async function testAndroidGateway({ url, login, password }) {
  const baseUrl = normalizeBaseUrl(url);

  if (!login || !password) {
    throw new Error("Телефондаги логин ва парол киритилмаган");
  }

  try {
    // Авторизация талаб қиладиган енгил сўров: логин/парол ҳам текширилади
    await axios.get(`${baseUrl}/webhooks`, {
      auth: { username: login, password },
      timeout: 8000,
    });
  } catch (error) {
    // Эски версияларда бу йўл бўлмаслиги мумкин: телефон жавоб берган,
    // авторизация эса ўтган ҳисобланади.
    if (error.response?.status === 404) {
      return true;
    }

    throw new Error(describeError(error));
  }

  return true;
}

// ============================================================
// SEND
// ============================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendAndroidSms({ url, login, password, messages }) {
  const baseUrl = normalizeBaseUrl(url);

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("СМС юбориш учун хабарлар мавжуд эмас");
  }

  const results = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const phone = `+${String(message.to).replace(/\D/g, "")}`;

    try {
      const response = await axios.post(
        `${baseUrl}/message`,
        {
          textMessage: { text: message.text },
          phoneNumbers: [phone],
        },
        {
          auth: { username: login, password },
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      results.push({
        to: phone,
        ok: true,
        id: response.data?.id || null,
        state: response.data?.state || null,
      });
    } catch (error) {
      const reason = describeError(error);

      results.push({ to: phone, ok: false, error: reason });

      // Телефонга умуман уланиб бўлмаса ёки парол нотўғри бўлса,
      // қолган хабарларни юбориб ўтиришдан маъно йўқ.
      const status = error.response?.status;

      if (!status || status === 401 || status === 403) {
        if (index === 0) {
          throw new Error(reason);
        }

        break;
      }
    }

    if (index < messages.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  const sent = results.filter((item) => item.ok).length;
  const failed = messages.length - sent;

  return { sent, failed, total: messages.length, results };
}

module.exports = {
  normalizeBaseUrl,
  testAndroidGateway,
  sendAndroidSms,
};
