const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

// ============================================================
// LOCAL APP DATA
// ============================================================

const dataDir =
  process.env.BLISS_DATA_DIR ||
  path.join(__dirname, ".data");

fs.mkdirSync(dataDir, {
  recursive: true,
});

// ============================================================
// JWT SECRET
//
// .env mavjud bo'lmasa:
// 1. AppData ichidan oldingi secret o'qiladi
// 2. Topilmasa yangi secret yaratiladi
// 3. Secret AppData ichiga saqlanadi
// ============================================================

const jwtSecretPath = path.join(
  dataDir,
  "jwt-secret"
);

if (!process.env.JWT_SECRET) {
  if (fs.existsSync(jwtSecretPath)) {
    process.env.JWT_SECRET = fs
      .readFileSync(jwtSecretPath, "utf8")
      .trim();
  }

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = crypto
      .randomBytes(48)
      .toString("hex");

    fs.writeFileSync(
      jwtSecretPath,
      process.env.JWT_SECRET,
      {
        encoding: "utf8",
        mode: 0o600,
      }
    );
  }
}

// ============================================================
// ADMIN CRM API
//
// Desktop CRM doim shu server bilan license tekshiradi.
// .env bo'lmasa ham ishlaydi.
// ============================================================

const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  "https://blissmebel.uz/api";

process.env.ADMIN_API_URL =
  ADMIN_API_URL;

// ============================================================
// MODULES
// ============================================================

const express = require("express");
const sequelize = require("./db");

const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// ============================================================
// ROUTES
// ============================================================

const localAuthRoutes = require("./routes/localAuth");
const productRoutes = require("./routes/products");
const clientRoutes = require("./routes/clients");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const backupRoutes = require("./routes/backups");
const smsRoutes =
  require("./routes/sms");
const {
  createBackup,
} = require("./services/backupService");

// ============================================================
// MODELS
// ============================================================

require("./models");
require("./models/localUser");

// ============================================================
// APP
// ============================================================

const app = express();

const PORT =
  process.env.PORT || 3008;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

// ============================================================
// ROUTES
// ============================================================

app.use("/crm", productRoutes);

app.use("/crm", localAuthRoutes);

app.use("/crm", clientRoutes);

app.use("/crm", orderRoutes);

app.use("/crm", paymentRoutes);

app.use("/crm", backupRoutes);

app.use("/crm", require("./routes/cloudBackup"));

app.use(
  "/crm",
  smsRoutes
);
// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "[BACKEND ERROR]",
      err
    );

    res.status(
      err.status || 500
    ).json({
      success: false,
      message:
        err.message ||
        "Сервер хатоси",
    });
  }
);

// ============================================================
// START
// ============================================================

async function start() {
  try {
    console.log(
      "========================================"
    );

    console.log(
      "[BLISS CRM] Starting..."
    );

    console.log(
      "[BLISS CRM] Data directory:",
      dataDir
    );

    console.log(
      "[BLISS CRM] Admin API:",
      ADMIN_API_URL
    );

    console.log(
      "[BLISS CRM] JWT secret:",
      process.env.JWT_SECRET
        ? "READY"
        : "MISSING"
    );

    console.log(
      "========================================"
    );

    await sequelize.authenticate();

    console.log(
      "[DATABASE] Connected"
    );

    await sequelize.sync();

    // Эски базаларда мижоз изоҳи устуни йўқ бўлса, қўшиб қўйилади
    const queryInterface = sequelize.getQueryInterface();
    const clientColumns = await queryInterface.describeTable("Clients");

    if (!clientColumns.description) {
      await queryInterface.addColumn("Clients", "description", {
        type: require("sequelize").DataTypes.TEXT,
        allowNull: true,
      });

      console.log("[DATABASE] Clients.description column added");
    }

    if (!clientColumns.lastSmsAt) {
      await queryInterface.addColumn("Clients", "lastSmsAt", {
        type: require("sequelize").DataTypes.DATE,
        allowNull: true,
      });

      console.log("[DATABASE] Clients.lastSmsAt column added");
    }

    // Соатни орқага суришдан ҳимоя учун устун
    const localUserTable = require("./models/localUser").getTableName();
    const localUserColumns = await queryInterface.describeTable(localUserTable);

    if (!localUserColumns.lastSeenAt) {
      await queryInterface.addColumn(localUserTable, "lastSeenAt", {
        type: require("sequelize").DataTypes.DATE,
        allowNull: true,
      });

      console.log("[DATABASE] LocalUsers.lastSeenAt column added");
    }

    // Сервердаги захира нусха учун устунлар
    const { DataTypes: BackupTypes } = require("sequelize");

    const backupColumns = {
      backupToken: { type: BackupTypes.TEXT, allowNull: true },
      lastBackupAt: { type: BackupTypes.DATE, allowNull: true },
      lastBackupHash: { type: BackupTypes.STRING, allowNull: true },
      lastBackupError: { type: BackupTypes.TEXT, allowNull: true },
    };

    for (const [columnName, definition] of Object.entries(backupColumns)) {
      if (!localUserColumns[columnName]) {
        await queryInterface.addColumn(localUserTable, columnName, definition);

        console.log(`[DATABASE] LocalUsers.${columnName} column added`);
      }
    }

    // Эски базаларга Android телефон орқали СМС юбориш устунлари қўшилади
    const smsColumns = await queryInterface.describeTable("sms_settings");
    const { DataTypes: SmsTypes } = require("sequelize");

    const newSmsColumns = {
      provider: { type: SmsTypes.STRING(20), allowNull: false, defaultValue: "eskiz" },
      androidUrl: { type: SmsTypes.STRING(255), allowNull: false, defaultValue: "" },
      androidLogin: { type: SmsTypes.STRING(255), allowNull: false, defaultValue: "" },
      androidPassword: { type: SmsTypes.TEXT, allowNull: false, defaultValue: "" },
      orderSmsEnabled: { type: SmsTypes.BOOLEAN, allowNull: false, defaultValue: false },
      orderSmsTemplate: { type: SmsTypes.TEXT, allowNull: false, defaultValue: "" },
      reminderEnabled: { type: SmsTypes.BOOLEAN, allowNull: false, defaultValue: false },
      reminderDays: { type: SmsTypes.INTEGER, allowNull: false, defaultValue: 7 },
      reminderStartedAt: { type: SmsTypes.DATE, allowNull: true },
    };

    for (const [columnName, definition] of Object.entries(newSmsColumns)) {
      if (!smsColumns[columnName]) {
        await queryInterface.addColumn("sms_settings", columnName, definition);

        console.log(`[DATABASE] sms_settings.${columnName} column added`);
      }
    }

    console.log(
      "[DATABASE] Synced"
    );

    // Қарздорларга даврий СМС эслатмалари (созламаларда ёқилган бўлса)
    require("./services/autoSms").startReminderScheduler();

    // Лицензия учун "охирги кўрилган вақт" белгисини юритиш
    require("./services/licenseClock").startClockHeartbeat();

    // Маълумотларни Admin CRM серверига захира нусха қилиб юбориш
    require("./services/cloudBackup").startCloudBackupScheduler();

    try {
      await createBackup();

      console.log(
        "[BACKUP] Created"
      );
    } catch (backupError) {
      console.error(
        "[BACKUP] Failed:",
        backupError.message
      );
    }

    app.listen(
      PORT,
      "127.0.0.1",
      () => {
        console.log(
          `[SERVER] Running on http://127.0.0.1:${PORT}`
        );

        console.log(
          `[LICENSE] Admin API: ${ADMIN_API_URL}`
        );
      }
    );
  } catch (error) {
    console.error(
      "[SERVER] Startup failed:",
      error
    );

    process.exit(1);
  }
}

start();