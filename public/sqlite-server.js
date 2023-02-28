const ws = require("ws");
const crypto = require("crypto");
const sqlite3 = require("./sqlite3-new");

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
    console.log(`Websocket listening on ${serverProcessPort}...`);
    this.setupServerListeners();
  }

  setupServerListeners() {
    const authToken = process.argv[3];
    console.log(`Set up server listener with auth (${authToken})...`);

    if (this.server) {
      this.server.on("connection", (conn) => {
        conn.on("message", (msg) => {
          const msgS = msg.toString();
          const { auth, id, filename, method, params } = JSON.parse(msgS);
          if (
            crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(authToken))
          ) {
            const callback = (error, result) => {
              conn.send(JSON.stringify({ id, result, error }));
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
        });
        conn.on("error", (error) => {
          console.error(`Connection error`, error);
        });
      });
      this.server.on("close", () => {
        console.log(`Closing websocket server ...`);
        if (!killed) {
          this.startWebsocketServer();
        }
      });
      this.server.on("error", (error) => {
        console.error(`[WS Server] An error occurred!`, error);
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
  console.log("Responding to SIGTERM and shutting down...");
  server.shutdown();
  killed = true;
  process.exit(0);
});
