const { contextBridge, ipcRenderer } = require("electron");

const arg = process.argv.find((a) => a.startsWith("--flashcard-base-url="));
const baseUrl = arg ? arg.slice("--flashcard-base-url=".length) : "";

contextBridge.exposeInMainWorld("flashcardApi", {
  baseUrl,
  openPath: (p) => ipcRenderer.invoke("flashcard:open-path", p),
});
