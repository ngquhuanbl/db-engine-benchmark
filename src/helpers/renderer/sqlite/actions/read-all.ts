import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadAllResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadAll } from "../../../shared/verify-result";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  const allPartititonKeys = getAllPossibleConvIds();

  //#region n transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-all][n-transaction] read all"
    );
    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
    const durations: number[] = [];
    const countRequests: Promise<void>[] = [];
    const results: Array<string[]> = [];
    for (let i = 0; i < readAllCount; i += 1) {
      if (PARTITION_MODE) {
        countRequests.push(
          new Promise<void>((resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            openSQLiteDatabase(SELECTED_PARTITION_KEY).then((conn) =>
              conn.all(query, undefined, (error, rows) => {
                finish();
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: ["preload-sqlite", "read-all", "n-transaction"],
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
        const subResult: string[] = [];
        const partitionRequests = allPartititonKeys.map(
          (partitionKey) =>
            new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              openSQLiteDatabase(partitionKey).then((conn) =>
                conn.all(query, undefined, (error, rows) => {
                  finish();
                  if (error) reject(error);
                  else {
                    resultLength += rows.length;
                    subResult.push(...rows.map(({ msgId }) => msgId));
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
                  "[preloaded-sqlite][read-all][n-transaction] insufficient full traverse",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
              results.push(subResult);
            })
            .catch((e) => {
              throw patchJSError(e, {
                tags: ["preloaded-sqlite", "read-all", "n-transaction"],
              });
            })
        );
      }
    }
    const start = performance.now();
    await Promise.all(countRequests).then(() =>
      verifyReadAll(results, datasetSize, +readAllCount)
    );
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / readAllCount;

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const start = performance.now();
    const durations: number[] = [];
    const results: Array<string[]> = [];
    if (PARTITION_MODE) {
      const logId = addLog(
        "[preloaded-sqlite][read-all][one-transaction] read all"
      );
      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const finish = () => {
          const end = performance.now();
          durations.push(end - start);
        };
        openSQLiteDatabase(SELECTED_PARTITION_KEY).then((conn) =>
          conn.serialize((conn) => {
            conn.run("BEGIN TRANSACTION", (error) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "preloaded-sqlite",
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
                      tags: ["preloaded-sqlite", "read-all", "1-transaction"],
                    })
                  );
                }
              });
            }

            conn.run("COMMIT TRANSACTION", (error) => {
              finish();
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "preloaded-sqlite",
                      "read-all",
                      "1-transaction",
                      "3 ranges",
                      "commit-transaction",
                    ],
                  })
                );
              else resolve();
              removeLog(logId);
            });
          })
        );
      });
    } else {
      const resultLengths: Record<number, number> = {};
      const logId = addLog(
        "[preloaded-sqlite][read-all][one-transaction] read all"
      );
      await Promise.all(
        allPartititonKeys.map(
          (partitionKey) =>
            new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              openSQLiteDatabase(partitionKey).then((conn) =>
                conn.serialize((conn) => {
                  conn.run("BEGIN TRANSACTION", (error) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "preloaded-sqlite",
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
                              "preloaded-sqlite",
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

                        if (results[i] === undefined) {
                          results[i] = [];
                        }
                        results[i].push(...rows.map(({ msgId }) => msgId));
                      }
                    });
                  }
                  conn.run("COMMIT TRANSACTION", (error) => {
                    finish();
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "preloaded-sqlite",
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
      ).then(() => verifyReadAll(results, datasetSize, +readAllCount));

      for (const resultLength of Object.values(resultLengths)) {
        if (resultLength !== datasetSize) {
          console.error(
            "[preloaded-sqlite][read-all][n-transaction] insufficient full traverse",
            {
              resultLength,
              datasetSize,
            }
          );
        }
      }
      removeLog(logId);
    }

    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / readAllCount;
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
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadAllExtraData
): Promise<ReadAllResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
