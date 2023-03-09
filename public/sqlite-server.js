const ws = require("ws");
const crypto = require("crypto");
const sqlite3 = require("./sqlite3-new");
const logger = require("electron-log");

let killed = false;

class SQLiteServer {
  constructor() {
    this.startWebsocketServer();
  }

  startWebsocketServer() {
    const serverProcessPort = parseInt(process.argv[2]);
    this.server = new ws.Server({
      port: serverProcessPort,
      host: "127.0.0.1",
    });
    logger.info(`Websocket listening on ${serverProcessPort}...`);
    this.setupServerListeners();
  }

  setupServerListeners() {
    const authToken = process.argv[3];
    logger.info(`Set up server listener with auth (${authToken})...`);

    if (this.server) {
      this.server.on("connection", (conn) => {
        conn.on("message", (msg) => {
          try {
            if (msg.constructor !== Buffer) return;

            const td = new TextDecoder("utf-8");
            const arrayData = new Uint8Array(msg);

            let rawString = "";
            try {
              rawString = td.decode(arrayData);
            } catch (e) {
              logger.error(`Can't decode binary data`, e);
              return;
            }

            if (typeof rawString === "string") {
              const { auth, id, filename, method, params } =
                JSON.parse(rawString);
              if (
                crypto.timingSafeEqual(
                  Buffer.from(auth),
                  Buffer.from(authToken)
                )
              ) {
                const callback = (error, result) => {
                  let dataLen = 0;
                  let encodeData = null;
                  const packedData = { id, result, error };
                  if (packedData && packedData.constructor === Object) {
                    const stringData = JSON.stringify(packedData);
                    const enc = new TextEncoder();
                    encodeData = enc.encode(stringData);
                    dataLen = encodeData.length;
                  }
                  if (encodeData && dataLen > 0) {
                    conn.send(encodeData.buffer);
                  }
                };
                switch (method) {
                  case "close": {
                    sqlite3.close(callback);
                    break;
                  }
                  case "all": {
                    sqlite3.all(filename, ...params, callback);
                    break;
                  }
                  case "run": {
                    sqlite3.run(filename, ...params, callback);
                    break;
                  }
                  case "get": {
                    sqlite3.get(filename, ...params, callback);
                    break;
                  }
                  case "exec": {
                    sqlite3.exec(filename, ...params, callback);
                    break;
                  }
                  case "serialize": {
                    sqlite3.serialize(filename, ...params, callback);
                    break;
                  }
                  default:
                }
              }
            }
          } catch (e) {
            logger.error(`Error while execute sqlite`, e);
          }
        });
        conn.on("error", (error) => {
          logger.error(`Connection error`, error);
        });
      });
      this.server.on("close", () => {
        logger.info(`Closing websocket server ...`);
        if (!killed) {
          this.startWebsocketServer();
        }
      });
      this.server.on("error", (error) => {
        logger.error(`[WS Server] An error occurred!`, error);
      });
    }
  }

  shutdown() {
    if (this.server) {
      this.server.close();
    }
  }
}

const server = new SQLiteServer();
process.on("SIGTERM", () => {
  logger.info("Responding to SIGTERM and shutting down...");
  server.shutdown();
  killed = true;
  process.exit(0);
});
