// import logger from "electron-log";
import sqlite3 from "../helpers/renderer/msg-channel/sqlite3";
import { getMsgPort } from "../helpers/shared/get-msg-port";

// @ts-ignore
getMsgPort().then((port) => {
  port.onmessage = (event) => {
    const msg = event.data;
    try {
      const { id, filename, method, params } = msg;
      const callback = (error, result) => {
		try {
			// @ts-ignore
			port.postMessage({ id, error, result });
		}
		catch(e) {
			debugger;
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
    } catch (e) {
      // logger.error(`Error while execute sqlite`, e);
    }
  };
});
