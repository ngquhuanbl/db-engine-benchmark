import {
  COLUMN_LIST_INFO,
  PRIMARY_KEYS,
  TABLE_NAME,
} from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
// import { DataLoaderImpl } from "../../../shared/data-loader";
import { escapeStr } from "../../../shared/escape-str";
import { getAllPossibleConvIds, getData } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadSingleItem } from "../../../shared/verify-result";
import { addLog, removeLog } from "../../log";
import { DAL } from "../library";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<SingleReadWriteResult> => {
  const DB = DAL.getInstance();

  const allPossibleConvIds = getAllPossibleConvIds();

  let partitionKeys: string[] = [];
  if (PARTITION_MODE) {
    partitionKeys = [SELECTED_PARTITION_KEY];
  } else {
    partitionKeys = [...allPossibleConvIds];
  }

  //   const dataLoader = DataLoaderImpl.getInstance();
  //   const data = await dataLoader.getDataset(datasetSize);

  async function resetData() {
    const addLogRequest = addLog("[nodeIntegration-sqlite] reset data");
    return DB.resetAllConvData().finally(() =>
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

    const requestsData: Array<{
      query: string;
      params: any;
      partitionKey: string;
    }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const convId = jsData.toUid;
      if (partitionKeys.includes(convId)) {
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
        requestsData.push({ query, params, partitionKey: convId });
      }
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params, partitionKey }) =>
          new Promise<void>((resolve, reject) => {
            DB.getConnectionForConv(partitionKey).then((conn) => {
              conn.run(query, params, (error) => {
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: ["preload-sqlite", "n-transaction", "write"],
                    })
                  );
                else {
                  resolve();
                }
              });
            });
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

    const requestsData: Array<{
      partitionKey: string;
      query: string;
      params: any;
    }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const { toUid: partitionKey } = item;
      if (partitionKeys.includes(partitionKey)) {
        const params: any[] = [];
        const primaryKeyConditions: string[] = [];
        PRIMARY_KEYS.forEach((key) => {
          primaryKeyConditions.push(`${escapeStr(key)}=?`);
          params.push(item[key]);
        });

        const query = `SELECT * FROM ${escapeStr(
          TABLE_NAME
        )} WHERE ${primaryKeyConditions.join(" AND ")}`;

        requestsData.push({ partitionKey, query, params });
      }
    }

    const checksumData: string[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ partitionKey, query, params }) =>
          new Promise<void>((resolve, reject) => {
            DB.getConnectionForConv(partitionKey).then((conn) => {
              conn.get(query, params, (error, row) => {
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: ["preload-sqlite", "n-transaction", "read"],
                    })
                  );
                else {
                  if (row) checksumData.push(row.msgId);
                  resolve();
                }
              });
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

    const groupByConvId: Record<string, { query: string; params: any }[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const { toUid: partitionKey } = jsData;
      if (partitionKeys.includes(partitionKey)) {
        if (groupByConvId[partitionKey] === undefined) {
          groupByConvId[partitionKey] = [];
        }

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

        groupByConvId[partitionKey].push({
          query,
          params,
        });
      }
    }

    const requestsData: Array<[string, { query: string; params: any }[]]> =
      Object.entries(groupByConvId);

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ([partitionKey, data]) =>
          new Promise<void>((resolve, reject) => {
            DB.getConnectionForConv(partitionKey).then((conn) => {
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
                data.forEach(({ query, params }) => {
                  conn.run(query, params, (error) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: ["preload-sqlite", "1-transaction", "write"],
                        })
                      );
                  });
                });
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
            });
          })
      )
    );
    const end = performance.now();

    oneTransactionWrite = end - start;

    addLogRequest.then((logId) => removeLog(logId));
  }

  // READ
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][one-transaction] read"
    );

    const groupByConvId: Record<string, { query: string; params: any }[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const { toUid } = jsData;
      if (partitionKeys.includes(toUid)) {
        if (groupByConvId[toUid] === undefined) {
          groupByConvId[toUid] = [];
        }

        const params: any[] = [];
        const primaryKeyConditions: string[] = [];
        PRIMARY_KEYS.forEach((key) => {
          primaryKeyConditions.push(`${escapeStr(key)}=?`);
          params.push(jsData[key]);
        });

        const query = `SELECT * FROM ${escapeStr(
          TABLE_NAME
        )} WHERE ${primaryKeyConditions.join(" AND ")}`;

        groupByConvId[toUid].push({ query, params });
      }
    }
    const requestsData: Array<[string, { query: string; params: any }[]]> =
      Object.entries(groupByConvId);

    const checksumData: string[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ([partitionKey, data]) =>
          new Promise<void>((resolve, reject) => {
            DB.getConnectionForConv(partitionKey).then((conn) =>
              conn.serialize((conn) => {
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
                data.forEach(({ query, params }) => {
                  conn.get(query, params, (error, row) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "1-transaction",
                            "read",
                          ],
                        })
                      );
                    else {
                      if (row) checksumData.push(row.msgId);
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
              })
            );
          })
      )
    );
    const end = performance.now();
    oneTransactionRead = end - start;

    verifyReadSingleItem(checksumData, datasetSize);

    addLogRequest.then((logId) => removeLog(logId));
  }

  //#endregion

  //   conn.close((error) => {
  //     if (error) throw error;
  //   });

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
