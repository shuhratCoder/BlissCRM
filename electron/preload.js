const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  printReceipt: (payload) =>
    ipcRenderer.invoke("print-receipt", payload),
});