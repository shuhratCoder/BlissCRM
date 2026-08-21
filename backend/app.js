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
const printerRoutes = require("./routes/printer");
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

app.use("/crm", printerRoutes);
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
        "Server Error",
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

    console.log(
      "[DATABASE] Synced"
    );

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