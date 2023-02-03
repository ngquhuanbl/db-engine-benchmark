import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadAllResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  const DB = DAL.getInstance();

  const allPartititonKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-all][n-transaction] read all"
    );
    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
    const durations: number[] = [];
    const countRequests: Promise<void>[] = [];
    for (let i = 0; i < readAllCount; i += 1) {
      if (PARTITION_MODE) {
        countRequests.push(
          new Promise<void>((resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            DB.getConnectionForConv(SELECTED_PARTITION_KEY).then((conn) =>
              conn.all(query, undefined, (error) => {
                finish();
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-all",
                        "n-transaction",
                      ],
                    })
                  );
                else {
                  // Traverse one partition -> No need to do checksum
                  resolve();
                }
              })
            );
          })
        );
      } else {
        let resultLength = 0;
        const partitionRequests = allPartititonKeys.map(
          (partitionKey) =>
            new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              DB.getConnectionForConv(partitionKey).then((conn) =>
                conn.all(query, undefined, (error, rows) => {
                  finish();
                  if (error) reject(error);
                  else {
                    resultLength += rows.length;
                    resolve();
                  }
                })
              );
            })
        );
        countRequests.push(
          Promise.all(partitionRequests)
            .then(() => {
              if (resultLength !== datasetSize) {
                console.error(
                  "[nodeIntegration-sqlite][read-all][n-transaction] insufficient full traverse",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
            })
            .catch((e) => {
              throw patchJSError(e, {
                tags: ["nodeIntegration-sqlite", "read-all", "n-transaction"],
              });
            })
        );
      }
    }
    const start = performance.now();
    await Promise.all(countRequests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / readAllCount;

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const start = performance.now();
    const durations: number[] = [];
    if (PARTITION_MODE) {
      const addLogRequest = addLog(
        "[nodeIntegration-sqlite][read-all][one-transaction] read all"
      );
      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const finish = () => {
          const end = performance.now();
          durations.push(end - start);
        };
        DB.getConnectionForConv(SELECTED_PARTITION_KEY).then((conn) =>
          conn.serialize(() => {
            conn.run("BEGIN TRANSACTION", (error) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "nodeIntegration-sqlite",
                      "read-all",
                      "1-transaction",
                      "3 ranges",
                      "begin-transaction",
                    ],
                  })
                );
            });

            for (let i = 0; i < readAllCount; i += 1) {
              const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
              conn.all(query, undefined, (error) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-all",
                        "1-transaction",
                      ],
                    })
                  );
                } else {
                  // No need to do checksum since we only read from one partition
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
                      "read-all",
                      "1-transaction",
                      "3 ranges",
                      "commit-transaction",
                    ],
                  })
                );
              else resolve();
              addLogRequest.then((logId) => removeLog(logId));
            });
          })
        );
      });
    } else {
      const resultLengths: Record<number, number> = {};
      const addLogRequest = addLog(
        "[nodeIntegration-sqlite][read-all][one-transaction] read all"
      );
      await Promise.all(
        allPartititonKeys.map(
          (partitionKey) =>
            new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                console.log(`huannq`, { end, start });
                durations.push(end - start);
              };
              DB.getConnectionForConv(partitionKey).then((conn) =>
                conn.serialize((conn) => {
                  conn.run("BEGIN TRANSACTION", (error) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-all",
                            "1-transaction",
                            "begin-transaction",
                          ],
                        })
                      );
                  });
                  for (let i = 0; i < readAllCount; i += 1) {
                    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
                    conn.all(query, undefined, (error, rows) => {
                      if (error) {
                        reject(
                          patchJSError(error, {
                            tags: [
                              "nodeIntegration-sqlite",
                              "read-all",
                              "1-transaction",
                            ],
                          })
                        );
                      } else {
                        if (resultLengths[i] === undefined) {
                          resultLengths[i] = 0;
                        }
                        resultLengths[i] += rows.length;
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
                            "read-all",
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
      );

      for (const resultLength of Object.values(resultLengths)) {
        if (resultLength !== datasetSize) {
          console.error(
            "[nodeIntegration-sqlite][read-all][n-transaction] insufficient full traverse",
            {
              resultLength,
              datasetSize,
            }
          );
        }
      }
      addLogRequest.then((logId) => removeLog(logId));
    }

    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / readAllCount;
    console.log({ accumulateSum, oneTransactionAverage });
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
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  extraData?: ReadAllExtraData
): Promise<ReadAllResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
