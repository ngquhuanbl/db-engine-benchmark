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
import { verifyReadSingleItem } from "../../../shared/verify-result";
import { addLog, removeLog } from "../../log";
import { DAL } from "../library";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<SingleReadWriteResult> => {
  const DB = DAL.getInstance();

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
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const params: any = {};
      const fieldList: string[] = [];
      const valuesPlaceholder: string[] = [];
      const convId = jsData.toUid;
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
      requests.push(
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          DB.getConnectionForConv(convId).then((conn) => {
            conn.run(query, params, (error) => {
              finish();
              if (error)
                reject(
                  patchJSError(error, {
                    tags: ["nodeIntegration-sqlite", "n-transaction", "write"],
                  })
                );
              else resolve();
            });
          });
        })
      );
    }
    await Promise.all(requests).finally(() => {
      addLogRequest.then((logId) => removeLog(logId));
    });
    nTransactionWrite = durations.reduce(
      (result, current) => result + current,
      0
    );
  }

  // READ
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][n-transaction] read"
    );
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    const result: string[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const params: any[] = [];
      const primaryKeyConditions: string[] = [];
      const convId = jsData.toUid;
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(`${escapeStr(key)}=?`);
        params.push(jsData[key]);
      });

      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;

      requests.push(
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          DB.getConnectionForConv(convId).then((conn) => {
            conn.get(query, params, (error, row) => {
              finish();
              if (error)
                reject(
                  patchJSError(error, {
                    tags: ["nodeIntegration-sqlite", "n-transaction", "read"],
                  })
                );
              else {
                if (row) result.push(row.msgId);
                resolve();
              }
            });
          });
        })
      );
    }
    await Promise.all(requests).finally(() => {
      addLogRequest.then((logId) => removeLog(logId));
      verifyReadSingleItem(result, datasetSize);
    });
    nTransactionRead = durations.reduce(
      (result, current) => result + current,
      0
    );
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
    const groupByConvId: Record<string, any[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const { toUid } = jsData;
      if (groupByConvId[toUid] === undefined) {
        groupByConvId[toUid] = [];
      }
      groupByConvId[toUid].push(jsData);
    }

    const entries = Object.entries(groupByConvId);
    const durations: number[] = [];
    const requests = entries.map(
      ([convId, data]) =>
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          DB.getConnectionForConv(convId).then((conn) =>
            conn.serialize((conn) => {
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
                )} (${fieldList.join(",")}) VALUES (${valuesPlaceholder.join(
                  ", "
                )})`;
                conn.run(query, params, (error) => {
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "1-transaction",
                          "write",
                        ],
                      })
                    );
                });
              });

              conn.run("COMMIT TRANSACTION", (error) => {
                finish();
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
            })
          );
        })
    );

    await Promise.all(requests).finally(() => {
      addLogRequest.then((logId) => removeLog(logId));
    });
    oneTransactionWrite = durations.reduce(
      (result, current) => result + current,
      0
    );
  }

  // READ
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][single-read-write][one-transaction] read"
    );
    const groupByConvId: Record<string, any[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const { toUid } = jsData;
      if (groupByConvId[toUid] === undefined) {
        groupByConvId[toUid] = [];
      }
      groupByConvId[toUid].push(jsData);
    }
    const entries = Object.entries(groupByConvId);
    const durations: number[] = [];
    const result: string[] = [];
    const requests = entries.map(
      ([convId, data]) =>
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          DB.getConnectionForConv(convId).then((conn) =>
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
                    if (row) result.push(row.msgId);
                  }
                });
              });

              conn.run("COMMIT TRANSACTION", (error) => {
                finish();
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
    );

    await Promise.all(requests).finally(() => {
      addLogRequest.then((logId) => removeLog(logId));
      verifyReadSingleItem(result, datasetSize);
    });
    oneTransactionRead = durations.reduce(
      (result, current) => result + current,
      0
    );
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
