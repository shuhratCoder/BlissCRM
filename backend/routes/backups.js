const router = require("express").Router();
const fs = require("fs");
const path = require("path");

const sequelize = require("../db");
const authMiddleware = require("../middlewares/authorization");
const asyncHandler = require("../middlewares/asyncHandler");
const { createBackup } = require("../services/backupService");

function getPaths() {
  const dataDir = process.env.BLISS_DATA_DIR;

  if (!dataDir) {
    throw new Error("BLISS_DATA_DIR topilmadi");
  }

  return {
    dataDir,
    databasePath: path.join(dataDir, "database.sqlite"),
    backupDir: path.join(dataDir, "backups"),
  };
}

// ============================================================
// BACKUP LIST
// ============================================================

router.get(
  "/backups",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { backupDir } = getPaths();

    if (!fs.existsSync(backupDir)) {
      return res.json([]);
    }

    const backups = fs
      .readdirSync(backupDir)
      .filter(
        (file) =>
          file.startsWith("backup-") &&
          file.endsWith(".sqlite")
      )
      .map((file) => {
        const filePath = path.join(backupDir, file);
        const stat = fs.statSync(filePath);

        return {
          name: file,
          size: stat.size,
          createdAt: stat.mtime,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    return res.json(backups);
  })
);

// ============================================================
// CREATE BACKUP
// ============================================================

router.post(
  "/backups/create",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const backupPath = await createBackup();

    if (!backupPath) {
      return res.status(500).json({
        success: false,
        message: "Backup yaratilmadi",
      });
    }

    const stat = fs.statSync(backupPath);

    return res.status(201).json({
      success: true,
      message: "Backup yaratildi",
      backup: {
        name: path.basename(backupPath),
        size: stat.size,
        createdAt: stat.mtime,
      },
    });
  })
);

// ============================================================
// RESTORE BACKUP
// ============================================================

router.post(
  "/backups/restore",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Backup nomi majburiy",
      });
    }

    // Path traversal himoyasi
    if (path.basename(name) !== name) {
      return res.status(400).json({
        success: false,
        message: "Backup nomi noto'g'ri",
      });
    }

    if (
      !name.startsWith("backup-") ||
      !name.endsWith(".sqlite")
    ) {
      return res.status(400).json({
        success: false,
        message: "Backup fayli noto'g'ri",
      });
    }

    const {
      databasePath,
      backupDir,
    } = getPaths();

    const backupPath = path.join(
      backupDir,
      name
    );

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: "Backup topilmadi",
      });
    }

    // Tanlangan backup SQLite ekanini tekshiramiz
    const backupHeader = Buffer.alloc(16);
    const backupFd = fs.openSync(backupPath, "r");

    try {
      fs.readSync(
        backupFd,
        backupHeader,
        0,
        16,
        0
      );
    } finally {
      fs.closeSync(backupFd);
    }

    if (
      backupHeader.toString("utf8") !==
      "SQLite format 3\u0000"
    ) {
      return res.status(400).json({
        success: false,
        message: "Backup SQLite bazasi emas",
      });
    }

    // Restore oldidan emergency backup
    const emergencyBackup =
      await createBackup();

    if (!emergencyBackup) {
      return res.status(500).json({
        success: false,
        message:
          "Emergency backup yaratilmadi. Restore bekor qilindi",
      });
    }

    await sequelize.close();

    fs.copyFileSync(
      backupPath,
      databasePath
    );

    res.status(200).json({
  success: true,
  message:
    "Backup muvaffaqiyatli tiklandi",
  restartRequired: true,
});

// Response frontendga yetib borishini kutamiz
setTimeout(() => {
  console.log(
    "Restore completed. Backend restarting..."
  );

  process.exit(100);
}, 500);

return;
  })
);

module.exports = router;