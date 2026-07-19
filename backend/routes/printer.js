const express = require('express');
const router = express.Router();
const ptp = require("pdf-to-printer");
const PDFDocument = require("pdfkit"); // Toza Node.js PDF generatori (Brauzersiz)
const fs = require("fs");
const path = require("path");

const PRINTER_NAME = "Xprinter XP-80T"; 

// O'zbekcha maxsus harflarni printer to'g'ri o'qishi uchun standartlashtirish
function fixUzbekChars(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[‘’ʻʼ`']/g, "'")
    .replace(/ш/g, 'sh').replace(/Ш/g, 'Sh')
    .replace(/ч/g, 'ch').replace(/Ч/g, 'Ch');
}

router.post('/print-receipt', async (req, res) => {
  try {
    const { orderId, items, totalAmount, customerName, date } = req.body;

    if (!orderId || !items || !totalAmount) {
      return res.status(400).json({ success: false, message: "Ma'lumotlar to'liq emas!" });
    }

    // 80mm printer uchun optimal o'lcham (Nuqtalarda: 1 mm = 2.83 point)
    // 80mm = ~226 point kenglik. Balandlik mahsulot soniga qarab cho'ziladi.
    const pageHeight = 250 + (items.length * 35);
    const doc = new PDFDocument({
      size: [226, pageHeight],
      margins: { top: 10, bottom: 10, left: 10, right: 10 }
    });

    const tempFilePath = path.join(__dirname, `../temp_${Date.now()}.pdf`);
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    // Sarlavha
    doc.font('Courier-Bold').fontSize(14).text("BLISS MEBEL", { align: 'center' });
    doc.font('Courier').fontSize(8).text("Sifatli mebellar maskani", { align: 'center' });
    doc.moveDown(1);

    // Ma'lumotlar
    const checkDate = date || new Date().toLocaleString('uz-UZ');
    doc.fontSize(9).font('Courier')
       .text(`Sana: ${checkDate}`)
       .text(`Buyurtma ID: #${orderId}`);
    
    if (customerName) {
      doc.text(`Mijoz: ${fixUzbekChars(customerName)}`);
    }

    // Chiziq
    doc.moveDown(0.5);
    doc.text("-----------------------------------");
    doc.moveDown(0.5);

    // Mahsulotlar ro'yxati
    items.forEach(item => {
      const name = fixUzbekChars(item.name);
      const price = item.price.toLocaleString('uz-UZ');
      const itemTotal = (item.price * item.quantity).toLocaleString('uz-UZ');

      doc.font('Courier-Bold').text(name);
      doc.font('Courier').text(`${item.quantity} x ${price}`, { continued: true });
      doc.text(`${itemTotal} UZS`, { align: 'right' });
      doc.moveDown(0.5);
    });

    // Chiziq
    doc.text("-----------------------------------");
    doc.moveDown(0.5);

    // Umumiy Summa
    const finalTotal = totalAmount.toLocaleString('uz-UZ');
    doc.font('Courier-Bold').fontSize(11).text(`JAMI: ${finalTotal} UZS`, { align: 'right' });
    
    doc.moveDown(1);
    doc.font('Courier').fontSize(8).text("Xaridingiz uchun rahmat!", { align: 'center' });

    // Hujjatni yakunlash va faylga yozish
    doc.end();

    // Fayl to'liq yozilib bo'lingach printerga jo'natish
    stream.on('finish', async () => {
      try {
        await ptp.print(tempFilePath, { printer: PRINTER_NAME });
        fs.unlinkSync(tempFilePath); // Vaqtinchalik faylni o'chirish
        return res.status(200).json({ success: true, message: "Chek muvaffaqiyatli chop etildi!" });
      } catch (printError) {
        console.error("Chop etishda xato:", printError);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(500).json({ success: false, error: printError.message });
      }
    });

  } catch (error) {
    console.error("Tizim xatoligi:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
