// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcMain, ipcRenderer } = require("electron");
const { USER_PATH } = require("./channel");
const sqlite3 = require("./nativelibs/sqlite3");

// As an example, here we use the exposeInMainWorld API to expose the browsers
// and node versions to the main window.
process.once("loaded", () => {
  contextBridge.exposeInMainWorld("sqlite3", sqlite3.verbose());
  contextBridge.exposeInMainWorld("path", {
    getUserPath: () => ipcRenderer.invoke(USER_PATH),
  });
});
