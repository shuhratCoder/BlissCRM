const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require("electron");
const { PosPrinter } = require("electron-pos-printer");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

app.setName("BLISS ERP");

const blissUserData = path.join(
  app.getPath("appData"),
  "BLISS ERP"
);

app.setPath("userData", blissUserData);

const isDev = !app.isPackaged;

let mainWindow = null;
let backendProcess = null;
let frontendProcess = null;

function writeLog(message) {
  const logPath = path.join(
    app.getPath("userData"),
    "bliss.log"
  );

  const text =
    `[${new Date().toISOString()}] ${message}\n`;

  fs.appendFileSync(logPath, text);

  console.log(message);
}

function getAppPath(...paths) {
  if (isDev) {
    return path.join(
      __dirname,
      "..",
      ...paths
    );
  }

  return path.join(
    process.resourcesPath,
    "app.asar",
    ...paths
  );
}

function startBackend() {
  const backendPath = getAppPath(
    "backend",
    "app.js"
  );

  writeLog(
    `BACKEND PATH: ${backendPath}`
  );

  backendProcess = spawn(
    process.execPath,
    [backendPath],
    {
      env: {
        ...process.env,

        BLISS_DATA_DIR:
          app.getPath("userData"),

        ELECTRON_RUN_AS_NODE: "1",

        PORT: "3008",
      },

      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    }
  );

  backendProcess.stdout.on(
    "data",
    (data) => {
      writeLog(
        `[BACKEND] ${data.toString()}`
      );
    }
  );

  backendProcess.stderr.on(
    "data",
    (data) => {
      writeLog(
        `[BACKEND ERROR] ${data.toString()}`
      );
    }
  );

  backendProcess.on(
    "exit",
    (code) => {
      writeLog(
        `BACKEND EXIT: ${code}`
      );
    }
  );
}

function startFrontend() {
  if (isDev) {
    writeLog(
      "DEV MODE: frontend tashqarida ishlaydi"
    );

    return;
  }

  const frontendDir = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "frontend",
    ".next",
    "standalone"
  );

  const serverPath = path.join(
    frontendDir,
    "server.js"
  );

  writeLog(
    `FRONTEND DIR: ${frontendDir}`
  );

  writeLog(
    `FRONTEND SERVER: ${serverPath}`
  );

  writeLog(
    `SERVER EXISTS: ${fs.existsSync(serverPath)}`
  );

  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Frontend server topilmadi: ${serverPath}`
    );
  }

  frontendProcess = spawn(
    process.execPath,
    [serverPath],
    {
      cwd: frontendDir,

      env: {
        ...process.env,

        ELECTRON_RUN_AS_NODE: "1",

        NODE_ENV: "production",

        PORT: "3009",

        HOSTNAME: "127.0.0.1",

        BACKEND_API_URL:
          "http://127.0.0.1:3008",
      },

      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],

      windowsHide: true,
    }
  );

  frontendProcess.stdout.on(
    "data",
    (data) => {
      writeLog(
        `[FRONTEND] ${data.toString()}`
      );
    }
  );

  frontendProcess.stderr.on(
    "data",
    (data) => {
      writeLog(
        `[FRONTEND ERROR] ${data.toString()}`
      );
    }
  );

  frontendProcess.on(
    "error",
    (error) => {
      writeLog(
        `FRONTEND SPAWN ERROR: ${error.stack}`
      );
    }
  );

  frontendProcess.on(
    "exit",
    (code) => {
      writeLog(
        `FRONTEND EXIT: ${code}`
      );
    }
  );
}
function waitForPort(
  port,
  timeout = 30000
) {
  return new Promise(
    (resolve, reject) => {
      const started = Date.now();

      function check() {
        const socket = net.createConnection({
          host: "127.0.0.1",
          port,
        });

        socket.on("connect", () => {
          socket.destroy();
          resolve();
        });

        socket.on("error", () => {
          socket.destroy();

          if (
            Date.now() - started >
            timeout
          ) {
            reject(
              new Error(
                `Port ${port} ochilmadi`
              )
            );

            return;
          }

          setTimeout(check, 500);
        });
      }

      check();
    }
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  minWidth: 1100,
  minHeight: 700,
// YANGI TO'G'RILANGAN HOLATI:
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,  // Asl holatiga (true) qaytaramiz
  nodeIntegration: false,  // Asl holatiga (false) qaytaramiz
},
});

  mainWindow.loadURL(
    "http://127.0.0.1:3009"
  );

  mainWindow.webContents.on(
    "did-fail-load",
    (
      event,
      errorCode,
      errorDescription
    ) => {
      writeLog(
        `PAGE LOAD ERROR: ${errorCode} ${errorDescription}`
      );
    }
  );
}
ipcMain.handle("print-receipt", async (_, payload) => {
  try {
    const {
      printerName,
      companyName,
      orderId,
      clientName,
      clientPhone,
      products = [],
      productsPrice = 0,
      serviceFee = 0,
      paidAmount = 0,
      debt = 0,
    } = payload;

    const total =
      Number(productsPrice) +
      Number(serviceFee);

    const data = [
      {
        type: "text",
        value: companyName || "BLISS ERP",
        style: {
          textAlign: "center",
          fontWeight: "700",
          fontSize: "22px",
        },
      },

      {
        type: "text",
        value: "SAVDO CHEKI",
        style: {
          textAlign: "center",
          fontWeight: "700",
          marginBottom: "10px",
        },
      },

      {
        type: "text",
        value:
          "--------------------------------",
      },

      {
        type: "text",
        value: `Buyurtma: ${orderId}`,
      },

      {
        type: "text",
        value: `Mijoz: ${clientName}`,
      },

      {
        type: "text",
        value: `Telefon: ${clientPhone}`,
      },

      {
        type: "text",
        value:
          "--------------------------------",
      },
    ];

    products.forEach((p) => {
      data.push({
        type: "text",
        value: `${p.name}   x${p.amount}`,
      });
    });

    data.push(
      {
        type: "text",
        value:
          "--------------------------------",
      },

      {
        type: "text",
        value: `Mahsulotlar: ${Number(
          productsPrice
        ).toLocaleString("uz-UZ")} so'm`,
      },

      {
        type: "text",
        value: `Xizmat: ${Number(
          serviceFee
        ).toLocaleString("uz-UZ")} so'm`,
      },

      {
        type: "text",
        value: `JAMI: ${total.toLocaleString(
          "uz-UZ"
        )} so'm`,
        style: {
          fontWeight: "700",
        },
      },

      {
        type: "text",
        value: `TO'LANDI: ${Number(
          paidAmount
        ).toLocaleString("uz-UZ")} so'm`,
      },

      {
        type: "text",
        value: `QARZ: ${Number(
          debt
        ).toLocaleString("uz-UZ")} so'm`,
      },

      {
        type: "text",
        value:
          "--------------------------------",
      },

      {
        type: "text",
        value: "Xaridingiz uchun rahmat!",
        style: {
          textAlign: "center",
          marginTop: "10px",
        },
      },
    );

    await PosPrinter.print(data, {
      preview: false,
      silent: true,
      printerName,
      copies: 1,
      margin: "0 0 0 0",
      pageSize: "80mm",
      timeOutPerLine: 200,
    });

    return {
      success: true,
    };
  } catch (err) {
    console.error(err);

    return {
      success: false,
      message: err.message,
    };
  }
});
async function startApplication() {
  try {
    writeLog(
      `APP PACKAGED: ${app.isPackaged}`
    );

    startBackend();

    startFrontend();

    writeLog(
      "3009 port kutilmoqda..."
    );

    await waitForPort(
      3009,
      30000
    );

    writeLog(
      "FRONTEND READY"
    );

    createWindow();

  } catch (error) {
    writeLog(
      `START ERROR: ${error.stack}`
    );

    dialog.showErrorBox(
      "BLISS ERP",
      `Dastur ishga tushmadi.\n\n${error.message}`
    );

    app.quit();
  }
}

// ====== PRINTER BUYRUQLARI (IPC) START ======
// Frontenddan kelgan chekni hech qanday oynasiz chop etish (Silent Print)
// ==========================================
// PRINTER BILAN JIMGINA (SILENT) ISHLASH QISMI
// ==========================================
const { app, BrowserWindow, ipcMain } = require('electron');

// Boshqa kodlar qatorida tursin:
ipcMain.on('print-silent', (event, htmlContent, printerName) => {
  // Yashirin (show: false) oyna ochamiz, foydalanuvchi buni ko'rmaydi
  let workerWindow = new BrowserWindow({ 
    show: false, 
    webPreferences: { 
      nodeIntegration: true,
      contextIsolation: false 
    } 
  });
  
  workerWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));
  
  workerWindow.webContents.on('did-finish-load', () => {
    // silent: true — Windows-ning print oynasini 100% bloklaydi
    workerWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: printerName || 'XP-80' 
    }, (success, failureReason) => {
      if (!success) console.log('Chop etishda xato:', failureReason);
      workerWindow.close(); // Ish tugagach xotiradan o'chiramiz
    });
  });
});


// Kompyuterda o'rnatilgan printerlar ro'yxatini frontendga uzatish
ipcMain.handle('get-printers', async () => {
  const dummyWindow = new BrowserWindow({ show: false });
  const printers = await dummyWindow.webContents.getPrintersAsync();
  dummyWindow.close();
  return printers; 
});
// ====== PRINTER BUYRUQLARI (IPC) END ======


// SIZDAGI MAVJUD ISHGA TUSHISH QATORLARI (O'zgartirmang, shundoq tursin)
app.whenReady().then(
  startApplication
);


app.on(
  "window-all-closed",
  () => {
    if (
      process.platform !== "darwin"
    ) {
      app.quit();
    }
  }
);

app.on(
  "before-quit",
  () => {
    if (backendProcess) {
      backendProcess.kill();
    }

    if (frontendProcess) {
      frontendProcess.kill();
    }
  }
);