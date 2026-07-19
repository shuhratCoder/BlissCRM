const fs = require("fs");
const path = require("path");
const sequelize = require("../db");

const MAX_BACKUPS = 30;

async function cleanupOldBackups(backupDir) {
  const files = fs
    .readdirSync(backupDir)
    .filter(
      (file) =>
        file.startsWith("backup-") &&
        file.endsWith(".sqlite")
    )
    .map((file) => {
      const filePath = path.join(
        backupDir,
        file
      );

      return {
        file,
        filePath,
        createdAt:
          fs.statSync(filePath).mtimeMs,
      };
    })
    .sort(
      (a, b) =>
        b.createdAt - a.createdAt
    );

  const oldBackups =
    files.slice(MAX_BACKUPS);

  for (const backup of oldBackups) {
    fs.unlinkSync(backup.filePath);

    console.log(
      "Old backup deleted:",
      backup.file
    );
  }
}

async function createBackup() {
  try {
    const dataDir =
      process.env.BLISS_DATA_DIR;

    if (!dataDir) {
      throw new Error(
        "BLISS_DATA_DIR topilmadi"
      );
    }

    const backupDir = path.join(
      dataDir,
      "backups"
    );

    fs.mkdirSync(backupDir, {
      recursive: true,
    });

    const date = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "");

    const backupPath = path.join(
      backupDir,
      `backup-${date}.sqlite`
    );

    await sequelize.query(
      "PRAGMA wal_checkpoint(FULL)"
    );

    await sequelize.query(
      `VACUUM INTO '${backupPath.replace(
        /'/g,
        "''"
      )}'`
    );

    console.log(
      "Safe database backup created:",
      backupPath
    );

    await cleanupOldBackups(
      backupDir
    );

    return backupPath;
  } catch (error) {
    console.error(
      "BACKUP ERROR:",
      error
    );

    return null;
  }
}

module.exports = {
  createBackup,
};