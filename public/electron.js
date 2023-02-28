// Module to control the application lifecycle and the native browser window.
const { app, BrowserWindow, protocol, ipcMain } = require("electron");
const path = require("path");
const url = require("url");
const {
  USER_PATH,
  JOIN_PATHS,
  MESSAGE,
  LOAD_DATA,
  LOAD_DATA_PROGRESS,
  WRITE_RESULT,
  SOCKET_CONFIG,
} = require("./channel");
const { DataLoaderImpl } = require("./data-loader");
const crypto = require("crypto");
const getPort = require("get-port");
const childProcess = require("child_process");
const fs = require("fs");

let serverProcess;
let serverProcessPort;
const authToken = crypto.randomBytes(20).toString("hex");
async function assignServerProcessPort() {
  serverProcessPort = await getPort({ host: "127.0.0.1" });
}
async function startupServer() {
  const executorPath = path.join(__dirname, "sqlite-server.js");
  await assignServerProcessPort();
  if (!serverProcessPort) {
    throw new Error("No process port assigned.");
  }

  const process = childProcess.fork(
    executorPath,
    [serverProcessPort.toString(), authToken],
    {
      stdio: ["pipe", "inherit", "pipe", "ipc"],
    }
  );

  process.on("error", (error) => {
    console.error("SQLite server process error", error);
  });

  if (process.stderr) {
    process.stderr.on("data", (data) => {
      console.log(data.toString());
    });
  }
  if (process.stdout) {
    process.stdout.on("data", (data) => {
      console.log(data.toString());
    });
  }
  return process;
}

async function startup() {
  if (!serverProcess) {
    serverProcess = await startupServer();
  }
}

// Create the native browser window.
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    // Set the path of an additional "preload" script that can be used to
    // communicate between node-land and browser-land.
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  // In production, set the initial browser path to the local bundle generated
  // by the Create React App build process.
  // In development, set it to localhost to allow live/hot-reloading.
  const appURL = app.isPackaged
    ? url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true,
      })
    : "http://localhost:3000";
  mainWindow.loadURL(appURL);

  // Automatically open Chrome's DevTools in development mode.
  //   if (!app.isPackaged) {
  //     mainWindow.webContents.openDevTools();
  //   }

  ipcMain.handle(USER_PATH, () => app.getPath("userData"));
  ipcMain.handle(JOIN_PATHS, (_, ...paths) => path.join(...paths));
  ipcMain.handle(SOCKET_CONFIG, () => ({ authToken, port: serverProcessPort }));
  return mainWindow;
}

// Create the native browser window.
function createNodeIntegrationWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    // Set the path of an additional "preload" script that can be used to
    // communicate between node-land and browser-land.
    webPreferences: {
      preload: path.join(__dirname, "nodeIntegration.preload.js"),
      contextIsolation: false,
      nodeIntegration: true,
    },
    show: false,
  });

  // In production, set the initial browser path to the local bundle generated
  // by the Create React App build process.
  // In development, set it to localhost to allow live/hot-reloading.
  const appURL = app.isPackaged
    ? url.format({
        pathname: path.join(__dirname, "node-integration.html"),
        protocol: "file:",
        slashes: true,
      })
    : "http://localhost:3001";
  mainWindow.loadURL(appURL);

  // Automatically open Chrome's DevTools in development mode.
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }
  return mainWindow;
}

// Setup a local proxy to adjust the paths of requested files when loading
// them from the local production bundle (e.g.: local fonts, etc...).
function setupLocalFilesNormalizerProxy() {
  protocol.registerHttpProtocol(
    "file",
    (request, callback) => {
      const url = request.url.substr(8);
      callback({ url: path.normalize(`${__dirname}/${url}`) });
    },
    (error) => {
      if (error) console.error("Failed to register protocol");
    }
  );
}

// This method will be called when Electron has finished its initialization and
// is ready to create the browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  try {
    await startup();

    const mainWindow = createWindow();
    const nodeIntegrationWindow = createNodeIntegrationWindow();

    ipcMain.on(MESSAGE, (event, message) => {
      const { sender } = event;

      if (sender === mainWindow.webContents) {
        nodeIntegrationWindow.webContents.send(MESSAGE, message);
      }
      if (sender === nodeIntegrationWindow.webContents) {
        mainWindow.webContents.send(MESSAGE, message);
      }
    });

    ipcMain.handle(LOAD_DATA, (_, datasetSize) => {
      const dataLoader = DataLoaderImpl.getInstance();
      return dataLoader.getDataset(datasetSize, (value) => {
        mainWindow.webContents.send(LOAD_DATA_PROGRESS, value);
      });
    });

    ipcMain.on(WRITE_RESULT, (event, message) => {
      const { datasetSize, benchmarkCount, result } = message;
      if (!(datasetSize && benchmarkCount && result)) {
        console.error("Invalid write-result message");
        return;
      }

      const fileName = `${datasetSize}_${benchmarkCount}.json`;
      const userPath = app.getPath("userData");
      const resultDir = path.join(userPath, "results");
      const filePath = path.join(resultDir, fileName);

      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir);
      }

      const data = JSON.stringify(result);
	  console.log(`=======================================`);
      console.log(`[▶️] Writing result file: ${filePath}`);
      fs.writeFileSync(filePath, data);
      console.log(`[✅] ${filePath} `);
	  console.log(`=======================================`);
    });

    setupLocalFilesNormalizerProxy();

    app.on("activate", function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        createNodeIntegrationWindow();
      }
    });
  } catch (e) {
    console.log("error", e);
  }
});

// Quit when all windows are closed, except on macOS.
// There, it's common for applications and their menu bar to stay active until
// the user quits  explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// If your app has no need to navigate or only needs to navigate to known pages,
// it is a good idea to limit navigation outright to that known scope,
// disallowing any other kinds of navigation.
const allowedNavigationDestinations = "https://my-electron-app.com";
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (!allowedNavigationDestinations.includes(parsedUrl.origin)) {
      event.preventDefault();
    }
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

app.on("before-quit", () => {
  console.log("Quitting ...");
  if (serverProcess) {
    console.log("Killing child process");
    serverProcess.kill("SIGTERM");
    serverProcess = undefined;
  }
});
