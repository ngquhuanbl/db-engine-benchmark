const { ipcRenderer } = require("electron");
const { USER_PATH, JOIN_PATHS, MESSAGE } = require("./channel");
const { DataLoaderImpl } = require("./data-loader");

window.path = {
  getUserPath: () => ipcRenderer.invoke(USER_PATH),
  join: (...paths) => ipcRenderer.invoke(JOIN_PATHS, ...paths),
};

window.__BUNDLENAME__ = { value: "node-integration" };

window.messageBroker = {
  addMessageListener: (listener) => {
    ipcRenderer.on(MESSAGE, listener);
  },
  removeMessageListener: (listener) =>
    ipcRenderer.removeListener(MESSAGE, listener),
  sendMessage: (message) => ipcRenderer.send(MESSAGE, message),
};

window.dataLoader = {
  getDataset: (datasetSize) => {
    const dataLoader = DataLoaderImpl.getInstance();
    return dataLoader.getDataset(datasetSize);
  },
};
