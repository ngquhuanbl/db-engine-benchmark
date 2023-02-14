import {
  COLUMN_LIST_INFO,
  PRIMARY_KEYS,
  TABLE_NAME,
} from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
// import { DataLoaderImpl } from "../../../shared/data-loader";
import { escapeStr } from "../../../shared/escape-str";
import { getData } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadSingleItem } from "../../../shared/verify-results";
import { addLog, removeLog } from "../../log";
import { openSQLiteDatabase, resetSQLiteData } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<SingleReadWriteResult> => {
  const conn = await openSQLiteDatabase();

  //   const dataLoader = DataLoaderImpl.getInstance();
  //   const data = await dataLoader.getDataset(datasetSize);

  async function resetData() {
    const addLogRequest = addLog("[nodeIntegration-sqlite] reset data");
    return resetSQLiteData(conn).finally(() =>
      addLogRequest.then((logId) => removeLog(logId))
    );
  }

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;

  // WRITE
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][n-transaction] write"
    );

    const requestsData: Array<{ query: string; params: any }> = [];
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
      requestsData.push({ query, params });
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params }) =>
          new Promise<void>((resolve, reject) => {
            conn.run(query, params, (error) =>
              error
                ? reject(
                    patchJSError(error, {
                      tags: ["nodeIntegration-sqlite", "n-transaction", "write"],
                    })
                  )
                : resolve()
            );
          })
      )
    );
    const end = performance.now();

    nTransactionWrite = end - start;

    addLogRequest.then((logId) => removeLog(logId));
  }

  // READ
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][n-transaction] read"
    );

    const requestsData: Array<{ query: string; params: any }> = [];
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
      requestsData.push({ query, params });
    }

    const checksumData: Array<string> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params }) =>
          new Promise<void>((resolve, reject) => {
            conn.get(query, params, (error, row) => {
              if (error) {
                reject(
                  patchJSError(error, {
                    tags: ["nodeIntegration-sqlite", "n-transaction", "read"],
                  })
                );
              } else {
                if (row) {
                  checksumData.push(row.msgId);
                }
                resolve();
              }
            });
          })
      )
    );
    const end = performance.now();

    nTransactionRead = end - start;

    verifyReadSingleItem(checksumData, datasetSize);

    addLogRequest.then((logId) => removeLog(logId));
  }

  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransactionRead = -1;
  let oneTransactionWrite = -1;

  // WRITE
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][one-transaction] write"
    );

    const requestsData: Array<{ query: string; params: any }> = [];
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

      requestsData.push({ query, params });
    }

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "1-transaction",
                  "write",
                  "begin-transaction",
                ],
              })
            );
        });

        requestsData.forEach(({ query, params }) => {
          conn.run(query, params, (error) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["nodeIntegration-sqlite", "1-transaction", "write"],
                })
              );
          });
        });

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "1-transaction",
                  "write",
                  "commit-transaction",
                ],
              })
            );
          else resolve();
        });
      });
    });
    const end = performance.now();

    oneTransactionWrite = end - start;

    addLogRequest.then((logId) => removeLog(logId));
  }

  // READ
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][one-transaction] read"
    );

    const requestsData: Array<{ query: string; params: any }> = [];
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

      requestsData.push({ query, params });
    }

    const checksumData: Array<string> = [];

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "1-transaction",
                  "read",
                  "begin-transaction",
                ],
              })
            );
        });

        requestsData.forEach(({ query, params }) => {
          conn.get(query, params, (error, row) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["nodeIntegration-sqlite", "1-transaction", "read"],
                })
              );
            else {
              if (row) {
                checksumData.push(row.msgId);
              }
            }
          });
        });

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "1-transaction",
                  "read",
                  "commit-transaction",
                ],
              })
            );
          else resolve();
        });
      });
    });
    const end = performance.now();

    oneTransactionRead = end - start;

    verifyReadSingleItem(checksumData, datasetSize);

    addLogRequest.then((logId) => removeLog(logId));
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
  readBatchSize: number
): Promise<SingleReadWriteResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize
  );
};
