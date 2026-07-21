const { contextBridge, ipcRenderer } = require('electron');

// Agar contextBridge allaqachon faylda ishlatilgan bo'lsa ham, boriga qo'shib qo'ying:
contextBridge.exposeInMainWorld('electronPrinter', {
  sendToPrinter: (htmlContent, printerName) => ipcRenderer.send('print-silent', htmlContent, printerName)
});
