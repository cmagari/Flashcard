const { contextBridge, ipcRenderer } = require("electron");

const baseUrl = ipcRenderer.sendSync("flashcard:base-url-sync");

contextBridge.exposeInMainWorld("flashcardApi", {
  baseUrl,
  getBaseUrl: () => ipcRenderer.invoke("flashcard:base-url"),
  openPath: (p) => ipcRenderer.invoke("flashcard:open-path", p),
  getDataDirOverride: () => ipcRenderer.invoke("flashcard:get-data-dir-override"),
  chooseDataDir: () => ipcRenderer.invoke("flashcard:choose-data-dir"),
  setDataDir: (dir) => ipcRenderer.invoke("flashcard:set-data-dir", dir),
  resetDataDir: () => ipcRenderer.invoke("flashcard:reset-data-dir"),
  listBackups: () => ipcRenderer.invoke("flashcard:list-backups"),
  restoreBackup: (filename) =>
    ipcRenderer.invoke("flashcard:restore-backup", filename),
});
