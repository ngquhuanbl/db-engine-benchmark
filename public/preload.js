// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer } = require("electron");
const { USER_PATH, JOIN_PATHS } = require("./channel");
const sqlite3 = require("./sqlite3");
const { execute: executeSQLiteRaw } = require("./execute.sqlite");

// As an example, here we use the exposeInMainWorld API to expose the browsers
// and node versions to the main window.
process.once("loaded", () => {
  contextBridge.exposeInMainWorld("rawSqlite3", {
    Database: {
      OPEN_READONLY: sqlite3.OPEN_READONLY,
      OPEN_READWRITE: sqlite3.OPEN_READWRITE,
      OPEN_CREATE: sqlite3.OPEN_CREATE,
      OPEN_SHAREDCACHE: sqlite3.OPEN_SHAREDCACHE,
      OPEN_PRIVATECACHE: sqlite3.OPEN_PRIVATECACHE,
      OPEN_URI: sqlite3.OPEN_URI,
	  execute: (dataset, addLog, removeLog) => executeSQLiteRaw(dataset, addLog, removeLog),
      getConnectionID: (filename, mode, callback) =>
        sqlite3.getConnectionID(filename, mode, callback),
      close: (connectionID, callback) => sqlite3.close(connectionID, callback),
      run: (connectionID, ...args) => sqlite3.run(connectionID, ...args),
      get: (connectionID, ...args) => sqlite3.get(connectionID, ...args),
      all: (connectionID, ...args) => sqlite3.all(connectionID, ...args),
      exec: (connectionID, sql, callback) =>
        sqlite3.exec(connectionID, sql, callback),
      serialize: (connectionID, commandData) =>
        sqlite3.serialize(connectionID, commandData),
    },
  });
  contextBridge.exposeInMainWorld("path", {
    getUserPath: () => ipcRenderer.invoke(USER_PATH),
    join: (...paths) => ipcRenderer.invoke(JOIN_PATHS, ...paths),
  });
});
