// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge } = require("electron");
const sqlite3 = require("./nativelibs/sqlite3");
const { app, remote } = require("electron");
const fs = require("fs");

// As an example, here we use the exposeInMainWorld API to expose the browsers
// and node versions to the main window.
// They'll be accessible at "window.versions".
process.once("loaded", () => {
  contextBridge.exposeInMainWorld("sqlite3", sqlite3);
  
  const appController = remote ? remote.app : app;
  contextBridge.exposeInMainWorld("userPath", appController.getPath('userData'));
});
