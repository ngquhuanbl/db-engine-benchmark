// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer } = require("electron");
const { USER_PATH, JOIN_PATHS } = require("./channel");
const sqlite3 = require("./sqlite3");

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
		getConnectionID: (filename, mode) => sqlite3.getConnectionID(filename, mode),
		close: (connectionID) => sqlite3.close(connectionID),
		run: (connectionID, sql, params) => sqlite3.run(connectionID, sql, params),
		get: (connectionID, sql, params) => sqlite3.get(connectionID, sql, params),
		exec: (connectionID, sql) => sqlite3.exec(connectionID, sql),
		all: (connectionID, sql, params) => sqlite3.all(connectionID, sql, params),
		serialize: (connectionID, commandData) => sqlite3.serialize(connectionID, commandData),
	}
  });
  contextBridge.exposeInMainWorld("path", {
    getUserPath: () => ipcRenderer.invoke(USER_PATH),
    join: (...paths) => ipcRenderer.invoke(JOIN_PATHS, ...paths),
  });
});
