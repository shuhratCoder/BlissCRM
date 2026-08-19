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
// .env bo'lmasa avtomatik yaratiladi
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
// CLOUD ADMIN API
// ============================================================

process.env.ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  "https://blissmebel.uz/api";

// ============================================================
// MODULES
// ============================================================

const express = require("express");
const sequelize = require("./db");

const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// ROUTES
const localAuthRoutes = require("./routes/localAuth");
const productRoutes = require("./routes/products");
const clientRoutes = require("./routes/clients");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const backupRoutes = require("./routes/backups");
const printerRoutes = require("./routes/printer");

const {
  createBackup,
} = require("./services/backupService");

require("./models");
require("./models/localUser");

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

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message:
      err.message || "Server Error",
  });
});

// ============================================================
// START
// ============================================================

async function start() {
  try {
    await sequelize.authenticate();

    await sequelize.sync();

    console.log(
      "Database connected successfully"
    );

    await createBackup();

    app.listen(PORT, () => {
      console.log(
        `Server is running on port ${PORT}`
      );

      console.log(
        `Admin API: ${process.env.ADMIN_API_URL}`
      );
    });
  } catch (error) {
    console.error(
      "Unable to connect to the database:",
      error
    );

    process.exit(1);
  }
}

start();