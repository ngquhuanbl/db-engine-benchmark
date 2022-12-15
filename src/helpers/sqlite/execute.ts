import {
  COLUMN_LIST_INFO,
  DB_NAME,
  PRIMARY_KEYS,
  TABLE_NAME,
} from "../../constants/schema";
import { Data } from "../../types/data";
import { Result } from "../../types/result";
import { Z_OPEN_MODE } from "../../constants/sqlite";
import { getDBFilePath } from "./directory";
import { escapeStr } from "../escape-str";
import { patchJSError } from "../patch-error";
import { Database } from "./library";

export async function execute(
  data: Array<Data>,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<Result> {
  const conn = await openDatabase();
  async function resetData() {
	// return;
    const logId = addLog("[sqlite] reset data");
    return new Promise<void>((resolve, reject) => {
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
    const start = performance.now();
    const logId = addLog("[sqlite][n-transaction] write");
    await Promise.all(
      data.map((jsData: any) => {
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
      })
    ).finally(() => removeLog(logId));
    const end = performance.now();
    nTransactionWrite = end - start;
  }

  // READ
  {
    const start = performance.now();
    const logId = addLog("[sqlite][n-transaction] read");
    await Promise.all(
      data.map((jsData: any) => {
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
      })
    ).finally(() => removeLog(logId));
    const end = performance.now();
    nTransactionRead = end - start;
  }

  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransactionRead = -1;
  let oneTransactionWrite = -1;
  /* 
  // WRITE
  {
    const start = performance.now();
    const logId = addLog("[sqlite][one-transaction] write");
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) =>
          error
            ? reject(
                patchJSError(error, {
                  tags: [
                    "sqlite",
                    "1-transaction",
                    "write",
                    "begin-transaction",
                  ],
                })
              )
            : null
        );
        data.forEach((jsData: any) => {
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
          conn.run(query, params, (error) =>
            error
              ? reject(
                  patchJSError(error, {
                    tags: ["sqlite", "1-transaction", "write"],
                  })
                )
              : resolve()
          );
        });

        conn.run("COMMIT TRANSACTION", (error) =>
          error
            ? reject(
                patchJSError(error, {
                  tags: [
                    "sqlite",
                    "1-transaction",
                    "write",
                    "commit-transaction",
                  ],
                })
              )
            : resolve()
        );
      });
    }).finally(() => removeLog(logId));
    const end = performance.now();
    oneTransactionWrite = end - start;
  }

  // READ
  {
    const start = performance.now();
    const logId = addLog("[sqlite][one-transaction] read");
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) =>
          error
            ? reject(
                patchJSError(error, {
                  tags: [
                    "sqlite",
                    "1-transaction",
                    "read",
                    "begin-transaction",
                  ],
                })
              )
            : null
        );
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

          conn.get(query, params, (error) =>
            error
              ? reject(
                  patchJSError(error, {
                    tags: ["sqlite", "1-transaction", "read"],
                  })
                )
              : resolve()
          );
        });

        conn.run("COMMIT TRANSACTION", (error) =>
          error
            ? reject(
                patchJSError(error, {
                  tags: [
                    "sqlite",
                    "1-transaction",
                    "read",
                    "commit-transaction",
                  ],
                })
              )
            : resolve()
        );
      });
    }).finally(() => removeLog(logId));
    const end = performance.now();
    oneTransactionRead = end - start;
  }
  //#endregion
*/
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

function openDatabase() {
  return new Promise<Database>(async (resolve, reject) => {
    try {
      const fileName = await getDBFilePath(DB_NAME);

      const instance = await new Promise<Database>((resolve, reject) => {
        const res = new Database(fileName, Z_OPEN_MODE, (error: any) => {
          if (error) reject(error);
          else resolve(res);
        });
      });

      // Create missing table
      const tableName = escapeStr(TABLE_NAME);
      const didTableExits = await new Promise<boolean>((resolve, reject) => {
        const queryStr = `SELECT name FROM sqlite_master WHERE type="table" AND name=${escapeStr(
          TABLE_NAME
        )}`;
        instance.all(queryStr, (error, rows) => {
          if (error) reject(error);
          else resolve(rows.length === 1);
        });
      });

      if (!didTableExits) {
        await new Promise<void>((resolve, reject) => {
          const definedFieldsSql = COLUMN_LIST_INFO.map(
            ({ name, type }) => `${name} ${type}`
          );
          definedFieldsSql.push(`PRIMARY KEY (${PRIMARY_KEYS.join(",")})`);

          const defineSchemaSql = definedFieldsSql.join(",");
          const query: string = `CREATE TABLE IF NOT EXISTS ${tableName} (${defineSchemaSql})`;
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
