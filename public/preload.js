// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer } = require("electron");
const {
  USER_PATH,
  JOIN_PATHS,
  MESSAGE,
  LOAD_DATA,
  LOAD_DATA_PROGRESS,
  WRITE_RESULT,
  SOCKET_CONFIG,
} = require("./channel");
const sqlite3 = require("./sqlite3");

let socketConfig = null;
ipcRenderer.on(SOCKET_CONFIG, (_, data) => {
	socketConfig = data;
})


// As an example, here we use the exposeInMainWorld API to expose the browsers
// and node versions to the main window.
process.once("loaded", () => {
  contextBridge.exposeInMainWorld("preloadedSQLite3", {
    Database: {
      OPEN_READONLY: sqlite3.OPEN_READONLY,
      OPEN_READWRITE: sqlite3.OPEN_READWRITE,
      OPEN_CREATE: sqlite3.OPEN_CREATE,
      OPEN_SHAREDCACHE: sqlite3.OPEN_SHAREDCACHE,
      OPEN_PRIVATECACHE: sqlite3.OPEN_PRIVATECACHE,
      OPEN_URI: sqlite3.OPEN_URI,
      getConnectionID: (filename, callback) =>
        sqlite3.getConnectionID(filename, callback),
      close: (connectionID, callback) => sqlite3.close(connectionID, callback),
      run: (connectionID, ...args) => sqlite3.run(connectionID, ...args),
      get: (connectionID, ...args) => {
		if (sqlite3 === undefined) {
			console.log('boom');
		}
		return sqlite3.get(connectionID, ...args)
	  },
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
  contextBridge.exposeInMainWorld("__BUNDLENAME__", { value: "renderer" });

  contextBridge.exposeInMainWorld("dataLoader", {
    getDataset: (datasetSize) => ipcRenderer.invoke(LOAD_DATA, datasetSize),
    addProgressListener: (listener) => {
      ipcRenderer.on(LOAD_DATA_PROGRESS, listener);
    },
  });

  contextBridge.exposeInMainWorld("messageBroker", {
    addMessageListener: (listener) => {
      ipcRenderer.on(MESSAGE, listener);
    },
    removeMessageListener: (listener) =>
      ipcRenderer.removeListener(MESSAGE, listener),
    sendMessage: (message) => ipcRenderer.send(MESSAGE, message),
  });
  
  contextBridge.exposeInMainWorld("resultHandler", {
	write: (message) => {
		ipcRenderer.send(WRITE_RESULT, message);
	}
  })
  
  contextBridge.exposeInMainWorld("socketConfig", {
	get: () => ipcRenderer.invoke(SOCKET_CONFIG)
  })
});
