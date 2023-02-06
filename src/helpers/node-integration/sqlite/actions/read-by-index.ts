import {
  INDEXED_KEYS,
  TABLE_NAME,
  INDEX_NAME,
} from "../../../../constants/schema";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyReadByIndexField } from "../../../shared/verify-result";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;

  const DB = DAL.getInstance();

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    let durations: number[] = [];
    const resultLengths: number[] = [];
    const start = performance.now();
    if (PARTITION_MODE) {
      await Promise.all(
        keys.map(
          (key, index) =>
            new Promise<void>((resolve, reject) => {
              const params: any[] = [JSON.stringify(key)];
              const indexedKeyConditions: string[] = [];
              INDEXED_KEYS.forEach((key) => {
                indexedKeyConditions.push(`${escapeStr(key)} =?`);
              });
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} INDEXED BY ${escapeStr(
                INDEX_NAME
              )} WHERE ${indexedKeyConditions.join(" AND ")}`;
              const addLogRequest = addLog(
                `[nodeIntegration-sqlite][read-by-index][n-transaction] index ${index}`
              );
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              DB.getConnectionForConv(SELECTED_PARTITION_KEY).then((conn) =>
                conn.all(query, params, (error) => {
                  finish();
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-by-index",
                          "n-transaction",
                          `index ${index}`,
                        ],
                      })
                    );
                  else {
                    resolve();
                    // No need to do checksum since indices are randomly generated; hence produce different result length
                  }
                  addLogRequest.then((logId) => removeLog(logId));
                })
              );
            })
        )
      );
    } else {
      await Promise.all(
        allPartitionKeys.map((partitionKey) => {
          const indexRequests = keys.map(
            (key, index) =>
              new Promise<void>((indexResolve, indexReject) => {
                const addLogRequest = addLog(
                  `[nodeIntegration-sqlite][read-by-index][n-transaction] index ${index}`
                );
                const params: any[] = [JSON.stringify(key)];
                const indexedKeyConditions: string[] = [];
                INDEXED_KEYS.forEach((key) => {
                  indexedKeyConditions.push(`${escapeStr(key)} =?`);
                });
                const query = `SELECT * FROM ${escapeStr(
                  TABLE_NAME
                )} INDEXED BY ${escapeStr(
                  INDEX_NAME
                )} WHERE ${indexedKeyConditions.join(" AND ")}`;
                const start = performance.now();
                const finish = () => {
                  const end = performance.now();
                  durations.push(end - start);
                };
                DB.getConnectionForConv(partitionKey).then((conn) =>
                  conn.all(query, params, (error, rows) => {
                    finish();
                    addLogRequest.then((logId) => removeLog(logId));
                    if (error) {
                      indexReject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-index",
                            "n-transaction",
                            `index ${index}`,
                          ],
                        })
                      );
                    } else {
                      if (rows) {
                        if (resultLengths[index] === undefined) {
                          resultLengths[index] = 0;
                        }
                        resultLengths[index] += rows.length;
                      }
                      indexResolve();
                    }
                  })
                );
              })
          );
          return Promise.all(indexRequests);
        })
      ).then(() => {
        verifyReadByIndexField(resultLengths, keys);
      });
    }
    const end = performance.now();
    nTransactionSum = end - start;

    nTransactionSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = nTransactionSum / numOfKeys;
  }
  //#endregion

  //#region one transaction
  {
    const durations: number[] = [];
    const start = performance.now();
    const resultLengths: number[] = [];
    if (PARTITION_MODE) {
      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const finish = () => {
          const end = performance.now();
          durations.push(end - start);
        };
        DB.getConnectionForConv(SELECTED_PARTITION_KEY).then((conn) =>
          conn.serialize((conn) => {
            conn.run("BEGIN TRANSACTION", (error) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "nodeIntegration-sqlite",
                      "read-by-index",
                      "1-transaction",
                      "begin-transaction",
                    ],
                  })
                );
            });

            for (let index = 0; index < numOfKeys; index += 1) {
              const key = keys[index];
              const params: any[] = [JSON.stringify(key)];
              const indexedKeyConditions: string[] = [];
              INDEXED_KEYS.forEach((key) => {
                indexedKeyConditions.push(`${escapeStr(key)} =?`);
              });
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} INDEXED BY ${escapeStr(
                INDEX_NAME
              )} WHERE ${indexedKeyConditions.join(" AND ")}`;
              const addLogRequest = addLog(
                `[nodeIntegration-sqlite][read-by-index][one-transaction] index ${index}`
              );
              conn.all(query, params, (error) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-index",
                        "1-transaction",
                        `index ${index}`,
                      ],
                    })
                  );
                }
                addLogRequest.then((logId) => removeLog(logId));
              });
            }

            conn.run("COMMIT TRANSACTION", (error) => {
              finish();
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "nodeIntegration-sqlite",
                      "read-by-index",
                      "1-transaction",
                      "commit-transaction",
                    ],
                  })
                );
              else resolve();
            });
          })
        );
      });
    } else {
      await Promise.all(
        allPartitionKeys.map(
          (partitionKey) =>
            new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              DB.getConnectionForConv(partitionKey).then((conn) =>
                conn.serialize((conn) => {
                  conn.run("BEGIN TRANSACTION", (error) => {
                    if (error) throw error;
                  });

                  for (let index = 0; index < numOfKeys; index += 1) {
                    const key = keys[index];
                    const params: any[] = [JSON.stringify(key)];
                    const indexedKeyConditions: string[] = [];
                    INDEXED_KEYS.forEach((key) => {
                      indexedKeyConditions.push(`${escapeStr(key)} =?`);
                    });
                    const query = `SELECT * FROM ${escapeStr(
                      TABLE_NAME
                    )} INDEXED BY ${escapeStr(
                      INDEX_NAME
                    )} WHERE ${indexedKeyConditions.join(" AND ")}`;

                    const addLogRequest = addLog(
                      `[nodeIntegration-sqlite][read-by-index][one-transaction] index ${index}`
                    );
                    conn.all(query, params, (error, rows) => {
                      if (error) {
                        reject(
                          patchJSError(error, {
                            tags: [
                              "nodeIntegration-sqlite",
                              "read-by-index",
                              "1-transaction",
                              `index ${index}`,
                            ],
                          })
                        );
                      } else {
                        addLogRequest.then((logId) => removeLog(logId));

                        if (rows) {
                          if (resultLengths[index] === undefined) {
                            resultLengths[index] = 0;
                          }
                          resultLengths[index] += rows.length;
                        }
                      }
                    });
                  }

                  conn.run("COMMIT TRANSACTION", (error) => {
                    finish();
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-index",
                            "1-transaction",
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
      ).then(() => {
        verifyReadByIndexField(resultLengths, keys);
      });
    }
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfKeys;
  }
  //#endregion

  //   conn.close((error) => {
  //     if (error) throw error;
  //   });

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};

export const execute = async (
  benchmarkCount: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
