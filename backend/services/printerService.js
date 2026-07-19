const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const {
  printer,
  EscPosPrinterType,
} = require("@luisvillafania/escpos");
const ESC = "\x1B";
const GS = "\x1D";

function normalizeText(value) {
  return String(value ?? "");
}

function center(text) {
  return (
    ESC +
    "a" +
    "\x01" +
    normalizeText(text) +
    "\n"
  );
}

function left(text) {
  return (
    ESC +
    "a" +
    "\x00" +
    normalizeText(text) +
    "\n"
  );
}

function separator() {
  return "------------------------------------------\n";
}

function buildReceipt(data = {}) {
  const {
    companyName = "BLISS ERP",
    orderId = "-",
    clientName = "-",
    clientPhone = "-",
    products = [],
    serviceFee = 0,
    productsPrice = 0,
    paidAmount = 0,
    debt = 0,
    date = new Date(),
  } = data;

  let receipt = "";

  receipt += ESC + "@";

  receipt += center(companyName);
  receipt += center("SAVDO CHEKI");

  receipt += separator();

  receipt += left(`Buyurtma: ${orderId}`);
  receipt += left(`Mijoz: ${clientName}`);
  receipt += left(`Telefon: ${clientPhone}`);

  receipt += left(
    `Sana: ${new Date(date).toLocaleString(
      "uz-UZ"
    )}`
  );

  receipt += separator();

  if (
    Array.isArray(products) &&
    products.length > 0
  ) {
    receipt += left("MAHSULOTLAR:");

    for (const item of products) {
      const name =
        item.name ||
        item.productName ||
        "Mahsulot";

      const amount =
        Number(item.amount) || 0;

      receipt += left(
        `${name} x ${amount}`
      );
    }

    receipt += separator();
  }

  const total =
    Number(serviceFee) +
    Number(productsPrice);

  receipt += left(
    `Mahsulotlar: ${Number(
      productsPrice
    ).toLocaleString("uz-UZ")} so'm`
  );

  receipt += left(
    `Xizmat: ${Number(
      serviceFee
    ).toLocaleString("uz-UZ")} so'm`
  );

  receipt += separator();

  receipt += left(
    `JAMI: ${total.toLocaleString(
      "uz-UZ"
    )} so'm`
  );

  receipt += left(
    `TO'LANDI: ${Number(
      paidAmount
    ).toLocaleString("uz-UZ")} so'm`
  );

  receipt += left(
    `QARZ: ${Number(
      debt
    ).toLocaleString("uz-UZ")} so'm`
  );

  receipt += separator();

  receipt += center(
    "Xaridingiz uchun rahmat!"
  );

  receipt += "\n\n\n";

  receipt += GS + "V" + "\x00";

  return Buffer.from(receipt, "binary");
}

function printLan({
  ip,
  port = 9100,
  data,
}) {
  return new Promise(
    (resolve, reject) => {
      if (!ip) {
        return reject(
          new Error(
            "Printer IP manzili kiritilmagan"
          )
        );
      }

      const socket = new net.Socket();

      socket.setTimeout(10000);

      socket.connect(
        Number(port),
        ip,
        () => {
          const receipt =
            buildReceipt(data);

          socket.write(receipt, () => {
            socket.end();

            resolve({
              success: true,
              type: "lan",
              message:
                "Chek LAN printerga yuborildi",
            });
          });
        }
      );

      socket.on("timeout", () => {
        socket.destroy();

        reject(
          new Error(
            "Printer bilan ulanish vaqti tugadi"
          )
        );
      });

      socket.on("error", (error) => {
        socket.destroy();

        reject(
          new Error(
            `Printer xatosi: ${error.message}`
          )
        );
      });
    }
  );
}

async function printUsb({ printerName, data }) {
  try {
    console.log("Printer:", printerName);

    await printer.print(page);

    return {
      success: true,
      type: "usb",
      message: "Chek USB printerga yuborildi",
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
async function printMock(data) {
  const receipt =
    buildReceipt(data);

  console.log(
    "========== MOCK RECEIPT =========="
  );

  console.log(
    receipt.toString("binary")
  );

  console.log(
    "=================================="
  );

  return {
    success: true,
    type: "mock",
    message:
      "Test chek yaratildi. Printer ulanmagan.",
  };
}

async function printReceipt(
  settings,
  data
) {
  if (!settings) {
    throw new Error(
      "Printer sozlamalari topilmadi"
    );
  }

  switch (settings.connectionType) {
    case "lan":
      return printLan({
        ip: settings.ip,
        port: settings.port || 9100,
        data,
      });

    case "usb":
      return printUsb({
        printerName:
          settings.printerName,
        data,
      });

    case "mock":
      return printMock(data);

    default:
      throw new Error(
        `Noma'lum printer turi: ${settings.connectionType}`
      );
  }
}

module.exports = {
  buildReceipt,
  printReceipt,
  printLan,
  printUsb,
  printMock,
};