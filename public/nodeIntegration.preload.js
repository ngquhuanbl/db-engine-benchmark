const { ipcRenderer } = require("electron");
const { MESSAGE } = require("./channel");

window.path = {
  getUserPath: () => ipcRenderer.invoke(USER_PATH),
  join: (...paths) => ipcRenderer.invoke(JOIN_PATHS, ...paths),
};

window.__BUNDLENAME__ = { value: "node-integration" };

window.messageBroker = {
  addEventListener: (listener) => {
    ipcRenderer.on(MESSAGE, listener);
  },
  removeMessageListener: (listener) =>
    ipcRenderer.removeListener(MESSAGE, listener),
  sendMessage: (message) => ipcRenderer.send(MESSAGE, message),
};
