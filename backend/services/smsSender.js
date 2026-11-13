// ============================================================
// СМС юбориш: танланган усул (Эскиз ёки Android телефон) орқали.
// Қўлда юбориш (routes/sms.js) ҳам, автоматик СМС (autoSms.js) ҳам
// шу ердан фойдаланади.
// ============================================================

const {
  decryptPassword,
  sendBatchSms,
} = require("./eskizService");

const {
  sendAndroidSms,
} = require("./androidSmsService");

function normalizeProvider(value) {
  return value === "android" ? "android" : "eskiz";
}

// Танланган усул тўлиқ созланганми?
function isConfigured(settings) {
  if (!settings) {
    return false;
  }

  if (normalizeProvider(settings.provider) === "android") {
    return Boolean(
      settings.androidUrl &&
        settings.androidLogin &&
        settings.androidPassword
    );
  }

  return Boolean(settings.eskizLogin && settings.eskizPassword);
}

// messages: [{ user_sms_id, to: 998XXXXXXXXX (Number), text }]
// Қайтаради: { provider, sent, failed, total, error?, result }
async function sendViaProvider(settings, messages) {
  const provider = normalizeProvider(settings.provider);

  if (provider === "android") {
    const result = await sendAndroidSms({
      url: settings.androidUrl,
      login: settings.androidLogin,
      password: decryptPassword(settings.androidPassword),
      messages,
    });

    const firstError = result.results.find((item) => !item.ok);

    return {
      provider,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      error: firstError?.error || null,
      result,
    };
  }

  const result = await sendBatchSms({
    email: settings.eskizLogin,
    password: decryptPassword(settings.eskizPassword),
    messages,
  });

  return {
    provider,
    sent: messages.length,
    failed: 0,
    total: messages.length,
    error: null,
    result,
  };
}

module.exports = {
  normalizeProvider,
  isConfigured,
  sendViaProvider,
};
