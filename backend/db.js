const { Sequelize } = require("sequelize");
const path = require("path");
const fs = require("fs");

if (!process.env.BLISS_DATA_DIR) {
  throw new Error(
    "BLISS_DATA_DIR topilmadi. Backend Electron orqali ishga tushishi kerak."
  );
}

const dataDir = process.env.BLISS_DATA_DIR;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true,
  });
}

const dbPath = path.join(
  dataDir,
  "database.sqlite"
);

console.log("SQLite database path:", dbPath);

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false,
});

module.exports = sequelize;