import {
  COLUMN_LIST_INFO,
  TABLE_NAME,
  PRIMARY_KEYS,
} from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
// import { DataLoaderImpl } from "../../../shared/data-loader";
import { escapeStr } from "../../../shared/escape-str";
import { getData } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase, resetSQLiteData } from "../common";

const originalExecute = async (
	datasetSize: number,
	readUsingBatch: boolean,
	readBatchSize: number,
	addLog: (content: string) => number,
	removeLog: (id: number) => void
): Promise<SingleReadWriteResult> => {
  const conn = await openSQLiteDatabase();

  //   const dataLoader = DataLoaderImpl.getInstance();
  //   const data = await dataLoader.getDataset(datasetSize);

  async function resetData() {
    const logId = addLog("[preloaded-sqlite] reset data");
    return resetSQLiteData(conn).finally(() => removeLog(logId));
  }

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;

  // WRITE
  {
    const logId = addLog(
      "[preloaded-sqlite][single-read-write][n-transaction] write"
    );
    const requests: Promise<void>[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
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
      requests.push(
        new Promise<void>((resolve, reject) => {
          conn.run(query, params, (error) =>
            error
              ? reject(
                  patchJSError(error, {
                    tags: ["preload-sqlite", "n-transaction", "write"],
                  })
                )
              : resolve()
          );
        })
      );
    }
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
    const logId = addLog(
      "[preloaded-sqlite][single-read-write][n-transaction] read"
    );
    const requests: Promise<void>[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const params: any[] = [];
      const primaryKeyConditions: string[] = [];
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(`${escapeStr(key)}=?`);
        params.push(jsData[key]);
      });

      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;

      requests.push(
        new Promise<void>((resolve, reject) => {
          conn.get(query, params, (error) =>
            error
              ? reject(
                  patchJSError(error, {
                    tags: ["preload-sqlite", "n-transaction", "read"],
                  })
                )
              : resolve()
          );
        })
      );
    }
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
    const logId = addLog(
      "[preloaded-sqlite][single-read-write][one-transaction] write"
    );
    const start = performance.now();
    let end = -1;
    await new Promise<void>((resolve, reject) => {
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
                  "1-transaction",
                  "write",
                  "begin-transaction",
                ],
              })
            );
        });
        for (let i = 0; i < datasetSize; i += 1) {
          const jsData = getData(i);
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
                  tags: ["preload-sqlite", "1-transaction", "write"],
                })
              );
          });
        }

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
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
    const logId = addLog(
      "[preloaded-sqlite][single-read-write][one-transaction] read"
    );
    const start = performance.now();
    let end = -1;
    await new Promise<void>((resolve, reject) => {
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
                  "1-transaction",
                  "read",
                  "begin-transaction",
                ],
              })
            );
        });
        for (let i = 0; i < datasetSize; i += 1) {
          const jsData = getData(i);
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
                  tags: ["preload-sqlite", "1-transaction", "read"],
                })
              );
          });
        }

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
                  "1-transaction",
                  "read",
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

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<SingleReadWriteResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog
  );
};
