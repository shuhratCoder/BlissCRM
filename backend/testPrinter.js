const { printReceipt } = require("./services/printerService");

async function test() {
  try {
    const result = await printReceipt(
      {
        connectionType: "usb",
        printerName: "XP-80",
        paperWidth: 80,
      },
      {
        companyName: "BLISS MEBEL",
        orderId: "TEST-001",
        clientName: "Shuhrat Tuyboyev",
        clientPhone: "+998 90 123 45 67",
        products: [
          {
            name: "DSP",
            amount: 2,
            price: 750000,
          },
          {
            name: "Kley",
            amount: 1,
            price: 0,
          },
        ],
        serviceFee: 500000,
        productsPrice: 1500000,
        paidAmount: 1000000,
        debt: 1000000,
      }
    );

    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

test();