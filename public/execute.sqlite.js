const { ipcRenderer } = require("electron");
const { USER_PATH } = require("./channel");
const path = require("path");
const rawSQLite3 = require("./nativelibs/sqlite3");

function escapeStr(value) {
  if (!value) return "NULL";
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return value;
}

function patchJSError(Error, patchData) {
  const res = new Error();
  const { tags } = patchData;
  res.message = `${tags.map((tag) => `[${tag}]`).join("")} ${error.message}`;
  return res;
}

async function getDBFilePath(dbName) {
  const userPath = await ipcRenderer.invoke(USER_PATH);
  return path.join(userPath, "sqlite", `${dbName}.db`);
}

const DB_NAME = "core";
const TABLE_NAME = "message";
const PRIMARY_KEYS = ["msgId"];

const COLUMN_LIST_INFO = [
  { name: "msgId", type: "TEXT" },
  { name: "cliMsgId", type: "TEXT" },
  { name: "toUid", type: "TEXT" },
  { name: "msgType", type: "INTEGER" },
  { name: "sendDttm", type: "TEXT" },
  { name: "isExpired", type: "INTEGER" },
  { name: "isExpiredAll", type: "INTEGER" },
  { name: "message", type: "TEXT" },
  { name: "updateMemberIds", type: "TEXT" },
  { name: "act", type: "TEXT" },
  { name: "action", type: "TEXT" },
  { name: "eventInfo", type: "TEXT" },
  { name: "zglobalMsgId", type: "TEXT" },
  { name: "src", type: "INTEGER" },
  { name: "actionId", type: "TEXT" },
  { name: "status", type: "INTEGER" },
  { name: "notify", type: "TEXT" },
  { name: "mentions", type: "TEXT" },
  { name: "quote", type: "TEXT" },
  { name: "serverTime", type: "TEXT" },
  { name: "fromUid", type: "TEXT" },
  { name: "dName", type: "TEXT" },
  { name: "localDttm", type: "INTEGER" },
  { name: "ttl", type: "INTEGER" },
  { name: "st", type: "INTEGER" },
  { name: "at", type: "INTEGER" },
  { name: "cmd", type: "INTEGER" },
  { name: "originMsgType", type: "TEXT" },
  { name: "subState", type: "INTEGER" },
  { name: "e2eeStatus", type: "INTEGER" },
  { name: "sequenseId", type: "INTEGER" },
  { name: "isLocalMsgId", type: "INTEGER" },
  { name: "properties", type: "TEXT" },
  { name: "originTs", type: "TEXT" },
  { name: "subType", type: "INTEGER" },
  { name: "localPath", type: "TEXT" },
  { name: "folderPath", type: "TEXT" },
  { name: "root", type: "INTEGER" },
  { name: "syncFromMobile", type: "INTEGER" },
  { name: "topOut", type: "TEXT" },
  { name: "topOutTimeOut", type: "TEXT" },
  { name: "topOutImprTimeOut", type: "TEXT" },
  { name: "previewThumb", type: "TEXT" },
  { name: "refMessageId", type: "TEXT" },
  { name: "urgency", type: "INTEGER" },
  { name: "dimension", type: "TEXT" },
  { name: "extra", type: "TEXT" },
  { name: "_friendRequestData", type: "TEXT" },
  { name: "content", type: "TEXT" },
  { name: "isErrorInfo", type: "INTEGER" },
  { name: "hasReact", type: "INTEGER" },
  { name: "uidSenderDel", type: "TEXT" },
  { name: "footer", type: "TEXT" },
  { name: "sendErrorCode", type: "INTEGER" },
  { name: "__isUpdateMessage", type: "INTEGER" },
  { name: "__updateData", type: "TEXT" },
  { name: "width", type: "INTEGER" },
  { name: "height", type: "INTEGER" },
  { name: "zipKey", type: "TEXT" },
  { name: "resend", type: "TEXT" },
  { name: "cancelled", type: "INTEGER" },
  { name: "z_parsedTokens", type: "TEXT" },
  { name: "isLastMsg", type: "INTEGER" },
  { name: "isSelected", type: "INTEGER" },
  { name: "textArguments", type: "TEXT" },
  { name: "msgText", type: "TEXT" },
  { name: "actionText", type: "TEXT" },
  { name: "platformType", type: "INTEGER" },
  { name: "oldMsgId", type: "TEXT" },
  { name: "vOrient", type: "INTEGER" },
  { name: "fileSize", type: "INTEGER" },
  { name: "upSrc", type: "INTEGER" },
  { name: "reader", type: "INTEGER" },
  { name: "sequenceId", type: "INTEGER" },
  { name: "staredDttm", type: "INTEGER" },
];

var SQLITE_OPEN_MODE;
(function (SQLITE_OPEN_MODE) {
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_READONLY"] = 1)] = "OPEN_READONLY";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_READWRITE"] = 2)] = "OPEN_READWRITE";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_CREATE"] = 4)] = "OPEN_CREATE";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_DELETE_ON_CLOSE"] = 8)] =
    "OPEN_DELETE_ON_CLOSE";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_EXCLUSIVE"] = 16)] =
    "OPEN_EXCLUSIVE";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_AUTO_PROXY"] = 32)] =
    "OPEN_AUTO_PROXY";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_URI"] = 64)] = "OPEN_URI";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_MEMORY"] = 128)] = "OPEN_MEMORY";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_MAIN_DB"] = 256)] = "OPEN_MAIN_DB";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_TEMP_DB"] = 512)] = "OPEN_TEMP_DB";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_TRANSIENT_DB"] = 1024)] =
    "OPEN_TRANSIENT_DB";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_MAIN_JOURNAL"] = 2048)] =
    "OPEN_MAIN_JOURNAL";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_TEMP_JOURNAL"] = 4096)] =
    "OPEN_TEMP_JOURNAL";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_SUB_JOURNAL"] = 8192)] =
    "OPEN_SUB_JOURNAL";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_SUPER_JOURNAL"] = 16384)] =
    "OPEN_SUPER_JOURNAL";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_NO_MUTEX"] = 32768)] =
    "OPEN_NO_MUTEX";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_FULL_MUTEX"] = 65536)] =
    "OPEN_FULL_MUTEX";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_SHARED_CACHE"] = 131072)] =
    "OPEN_SHARED_CACHE";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_PRIVATE_CACHE"] = 262144)] =
    "OPEN_PRIVATE_CACHE";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_WAL"] = 524288)] = "OPEN_WAL";
  SQLITE_OPEN_MODE[(SQLITE_OPEN_MODE["OPEN_NOFOLLOW"] = 16777216)] =
    "OPEN_NOFOLLOW";
})(SQLITE_OPEN_MODE || (SQLITE_OPEN_MODE = {}));
const Z_OPEN_MODE =
  SQLITE_OPEN_MODE.OPEN_READWRITE |
  SQLITE_OPEN_MODE.OPEN_CREATE |
  SQLITE_OPEN_MODE.OPEN_WAL |
  SQLITE_OPEN_MODE.OPEN_PRIVATE_CACHE;

function openDatabase() {
  return new Promise(async (resolve, reject) => {
    try {
      const fileName = await getDBFilePath(DB_NAME);

      const instance = await new Promise((resolve, reject) => {
        const res = new rawSQLite3.Database(fileName, Z_OPEN_MODE, (error) => {
          if (error) reject(error);
          else resolve(res);
        });
      });

      // Create missing table
      const tableName = escapeStr(TABLE_NAME);
      const didTableExits = await new Promise((resolve, reject) => {
        const queryStr = `SELECT name FROM sqlite_master WHERE type="table" AND name=${escapeStr(
          TABLE_NAME
        )}`;
        instance.all(queryStr, (error, rows) => {
          if (error) reject(error);
          else resolve(rows.length === 1);
        });
      });

      if (!didTableExits) {
        await new Promise((resolve, reject) => {
          const definedFieldsSql = COLUMN_LIST_INFO.map(
            ({ name, type }) => `${name} ${type}`
          );
          definedFieldsSql.push(`PRIMARY KEY (${PRIMARY_KEYS.join(",")})`);

          const defineSchemaSql = definedFieldsSql.join(",");
          const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${defineSchemaSql})`;
          instance.run(query, (error) => (error ? reject(error) : resolve()));
        });
      }

      // Return the connection
      resolve(instance);
    } catch (e) {
      reject(e);
    }
  });
}

async function execute(data, addLog, removeLog) {
  const conn = await openDatabase();
  async function resetData() {
    const logId = addLog("[sqlite] reset data");
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM ${escapeStr(TABLE_NAME)}`;
      conn.exec(query, (error) =>
        error
          ? reject(patchJSError(error, { tags: ["sqlite", "reset-data"] }))
          : resolve()
      );
    }).finally(() => removeLog(logId));
  }

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;

  // WRITE
  {
    const logId = addLog("[sqlite][n-transaction] write");
    const requests = data.map((jsData) => {
      const params = {};
      const fieldList = [];
      const valuesPlaceholder = [];
      COLUMN_LIST_INFO.forEach(({ name, type }) => {
        fieldList.push(name);
        valuesPlaceholder.push(`$${name}`);
        const jsValue = jsData[name];

        if (type === "TEXT") {
          params[`$${name}`] = JSON.stringify(jsValue);
        } else {
          params[`$${name}`] = jsValue;
        }
      });

      const query = `INSERT OR REPLACE INTO ${escapeStr(
        TABLE_NAME
      )} (${fieldList.join(",")}) VALUES (${valuesPlaceholder.join(", ")})`;
      return new Promise((resolve, reject) => {
        conn.run(query, params, (error) =>
          error
            ? reject(
                patchJSError(error, {
                  tags: ["sqlite", "n-transaction", "write"],
                })
              )
            : resolve()
        );
      });
    });
    const start = performance.now();
    let end = -1;
    await Promise.all(requests).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    nTransactionWrite = end - start;
  }

  // READ
  {
    const logId = addLog("[sqlite][n-transaction] read");
    const requests = data.map((jsData) => {
      const params = [];
      const primaryKeyConditions = [];
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(`${escapeStr(key)}=?`);
        params.push(jsData[key]);
      });

      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;

      return new Promise((resolve, reject) => {
        conn.get(query, params, (error) =>
          error
            ? reject(
                patchJSError(error, {
                  tags: ["sqlite", "n-transaction", "read"],
                })
              )
            : resolve()
        );
      });
    });
    const start = performance.now();
    let end = -1;
    await Promise.all(requests).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    nTransactionRead = end - start;
  }

  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransactionRead = -1;
  let oneTransactionWrite = -1;

  // WRITE
  {
    const logId = addLog("[sqlite][one-transaction] write");
    const start = performance.now();
    let end = -1;
    await new Promise((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: ["sqlite", "1-transaction", "write", "begin-transaction"],
              })
            );
        });
        data.forEach((jsData) => {
          const params = {};
          const fieldList = [];
          const valuesPlaceholder = [];
          COLUMN_LIST_INFO.forEach(({ name, type }) => {
            fieldList.push(name);
            valuesPlaceholder.push(`$${name}`);
            const jsValue = jsData[name];

            if (type === "TEXT") {
              params[`$${name}`] = JSON.stringify(jsValue);
            } else {
              params[`$${name}`] = jsValue;
            }
          });

          const query = `INSERT OR REPLACE INTO ${escapeStr(
            TABLE_NAME
          )} (${fieldList.join(",")}) VALUES (${valuesPlaceholder.join(", ")})`;
          conn.run(query, params, (error) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["sqlite", "1-transaction", "write"],
                })
              );
          });
        });

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
                  "1-transaction",
                  "write",
                  "commit-transaction",
                ],
              })
            );
          else resolve();
        });
      });
    }).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    oneTransactionWrite = end - start;
  }

  // READ
  {
    const logId = addLog("[sqlite][one-transaction] read");
    const start = performance.now();
    let end = -1;
    await new Promise((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: ["sqlite", "1-transaction", "read", "begin-transaction"],
              })
            );
        });
        data.forEach((jsData) => {
          const params = [];
          const primaryKeyConditions = [];
          PRIMARY_KEYS.forEach((key) => {
            primaryKeyConditions.push(`${escapeStr(key)}=?`);
            params.push(jsData[key]);
          });

          const query = `SELECT * FROM ${escapeStr(
            TABLE_NAME
          )} WHERE ${primaryKeyConditions.join(" AND ")}`;

          conn.get(query, params, (error) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["sqlite", "1-transaction", "read"],
                })
              );
          });
        });

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: ["sqlite", "1-transaction", "read", "commit-transaction"],
              })
            );
          else resolve();
        });
      });
    }).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    oneTransactionRead = end - start;
  }

  //#endregion

  conn.close((error) => {
    if (error) throw error;
  });

  return {
    nTransactionRead,
    nTransactionWrite,
    oneTransactionRead,
    oneTransactionWrite,
  };
}

module.exports = {
  execute,
};
