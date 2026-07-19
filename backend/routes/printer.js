const router = require("express").Router();

const PrinterSetting = require(
  "../models/printerSetting"
);

const {
  printReceipt,
} = require(
  "../services/printerService"
);

const authMiddleware = require(
  "../middlewares/authorization"
);

const asyncHandler = require(
  "../middlewares/asyncHandler"
);


// GET SETTINGS
router.get(
  "/printer/settings",
  authMiddleware,
  asyncHandler(async (req, res) => {
    let settings =
      await PrinterSetting.findOne();

    if (!settings) {
      settings =
        await PrinterSetting.create({
          connectionType: "mock",
          port: 9100,
          paperWidth: 80,
        });
    }

    res.status(200).json(settings);
  })
);


// SAVE SETTINGS
router.put(
  "/printer/settings",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const {
  companyName,
  companyPhone,
  connectionType,
  printerName,
  ip,
  port,
  paperWidth,
} = req.body;
    if (
      !["mock", "lan", "usb"].includes(
        connectionType
      )
    ) {
      return res.status(400).json({
        message:
          "Printer ulanish turi noto'g'ri",
      });
    }

    if (
      connectionType === "lan" &&
      !ip
    ) {
      return res.status(400).json({
        message:
          "LAN printer uchun IP majburiy",
      });
    }

    if (
      connectionType === "usb" &&
      !printerName
    ) {
      return res.status(400).json({
        message:
          "USB printer nomi majburiy",
      });
    }

    let settings =
      await PrinterSetting.findOne();

    const data = {
  companyName:
    companyName || "BLISS MEBEL",

  companyPhone:
    companyPhone || null,

  connectionType,

  printerName:
    printerName || null,

  ip: ip || null,

  port: Number(port) || 9100,

  paperWidth:
    Number(paperWidth) || 80,
};

    if (!settings) {
      settings =
        await PrinterSetting.create(data);
    } else {
      await settings.update(data);
    }

    res.status(200).json({
      success: true,
      settings,
    });
  })
);


// TEST PRINT
router.post(
  "/printer/test",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const settings =
      await PrinterSetting.findOne();

    if (!settings) {
      return res.status(404).json({
        message:
          "Printer sozlamalari topilmadi",
      });
    }

    const result =
      await printReceipt(
        settings.toJSON(),
        {
          companyName: "BLISS ERP",

          orderId: "TEST-001",

          clientName:
            "TEST MIJOZ",

          clientPhone:
            "+998 00 000 00 00",

          products: [
            {
              name: "Test mahsulot",
              amount: 1,
            },
          ],

          productsPrice: 100000,

          serviceFee: 50000,

          paidAmount: 100000,

          debt: 50000,
        }
      );

    res.status(200).json(result);
  })
);

const { execFile } = require("child_process");

router.get(
  "/printer/windows-printers",
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (process.platform !== "win32") {
      return res.json({
        success: true,
        printers: [],
      });
    }

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-Printer | Select-Object Name,DriverName,PortName | ConvertTo-Json -Compress",
      ],
      {
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            "GET PRINTERS ERROR:",
            error,
            stderr
          );

          return res.status(500).json({
            success: false,
            message:
              "Windows printerlarini olishda xato",
          });
        }

        try {
          const output = stdout.trim();

          if (!output) {
            return res.json({
              success: true,
              printers: [],
            });
          }

          const parsed = JSON.parse(output);

          const printers = Array.isArray(parsed)
            ? parsed
            : [parsed];

          return res.json({
            success: true,
            printers,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            message:
              "Printer ma'lumotlarini o'qib bo'lmadi",
          });
        }
      }
    );
  })
);
module.exports = router;