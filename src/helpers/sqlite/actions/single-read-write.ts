import {
  TABLE_NAME,
  COLUMN_LIST_INFO,
  PRIMARY_KEYS,
} from "../../../constants/schema";
import { Action } from "../../../types/action";
import { SingleReadWriteResult } from "../../../types/result";
import { escapeStr } from "../../escape-str";
import { patchJSError } from "../../patch-error";
import { openSQLiteDatabase, resetSQLiteData } from "../common";

export const execute: Action<SingleReadWriteResult> = async (
  data,
  addLog,
  removeLog
) => {
  const conn = await openSQLiteDatabase();
  async function resetData() {
    const logId = addLog("[sqlite] reset data");
    return resetSQLiteData(conn).finally(() => removeLog(logId));
  }

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;

  // WRITE
  {
    const logId = addLog("[sqlite][single-read-write][n-transaction] write");
    const requests = data.map((jsData: any) => {
      const params: any = {};
      const fieldList: string[] = [];
      const valuesPlaceholder: string[] = [];
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
      return new Promise<void>((resolve, reject) => {
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
    const logId = addLog("[sqlite][single-read-write][n-transaction] read");
    const requests = data.map((jsData: any) => {
      const params: any[] = [];
      const primaryKeyConditions: string[] = [];
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(`${escapeStr(key)}=?`);
        params.push(jsData[key]);
      });

      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;

      return new Promise<void>((resolve, reject) => {
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
    const logId = addLog("[sqlite][single-read-write][one-transaction] write");
    const start = performance.now();
    let end = -1;
    await new Promise<void>((resolve, reject) => {
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: ["sqlite", "1-transaction", "write", "begin-transaction"],
              })
            );
        });
        data.forEach((jsData: any) => {
          const params: any = {};
          const fieldList: string[] = [];
          const valuesPlaceholder: string[] = [];
          COLUMN_LIST_INFO.forEach(({ name, type }) => {
            fieldList.push(name);
            valuesPlaceholder.push(`$${name}`);
            const jsValue = jsData[name];

            if (type === "TEXT") {
              if (typeof jsValue !== "string")
                params[`$${name}`] = JSON.stringify(jsValue);
              else params[`$${name}`] = jsValue;
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
    const logId = addLog("[sqlite][single-read-write][one-transaction] read");
    const start = performance.now();
    let end = -1;
    await new Promise<void>((resolve, reject) => {
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: ["sqlite", "1-transaction", "read", "begin-transaction"],
              })
            );
        });
        data.forEach((jsData: any) => {
          const params: any[] = [];
          const primaryKeyConditions: string[] = [];
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
};
