import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { getNonIndexConditionSQLite } from "../../../shared/non-index-conditions";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyNonIndexField } from "../../../shared/verify-result";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  const DB = DAL.getInstance();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  const allPartitionKeys = getAllPossibleConvIds();

  const checkStatement = getNonIndexConditionSQLite();

  // Checksum
  let resultsLength = -1;

  //#region n transaction
  {
    let durations: number[] = [];
    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;
    const results: Array<any[]> = [];
    const start = performance.now();
    if (PARTITION_MODE) {
      const countRequests: Promise<void>[] = [];
      for (let i = 0; i < count; i += 1) {
        const addLogRequest = addLog(
          `[nodeIntegration-sqlite][read-by-non-index][n-transaction] index ${i}`
        );
        const params = [];
        countRequests.push(
          new Promise((resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            DB.getConnectionForConv(SELECTED_PARTITION_KEY).then((conn) =>
              conn.all(query, params, (error, rows) => {
                finish();
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-non-index",
                        "n-transaction",
                        `index ${i}`,
                      ],
                    })
                  );
                else {
                  if (resultsLength === -1) resultsLength = rows.length;
                  else if (resultsLength !== rows.length) {
                    console.error(
                      "[nodeIntegration-sqlite][read-by-non-index][n-transaction] inconsistent result length",
                      {
                        expected: resultsLength,
                        actual: rows.length,
                      }
                    );
                  }
                  if (rows.length === 0) {
                    console.error(
                      `[nodeIntegration-sqlite][read-by-non-index][n-transaction] empty results`
                    );
                  }
                  resolve();
                }
                addLogRequest.then((logId) => removeLog(logId));
              })
            );
          })
        );
      }
      await Promise.all(countRequests);
    } else {
      let resultLengths: Record<number, number> = {};
      for (let i = 0; i < count; i += 1) {
        const addLogRequest = addLog(
          `[nodeIntegration-sqlite][read-by-non-index][n-transaction] index ${i}`
        );
        const params = [];
        const partitionRequests: Promise<void>[] = allPartitionKeys.map(
          (partitionKey) =>
            new Promise((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              DB.getConnectionForConv(partitionKey).then((conn) =>
                conn.all(query, params, (error, rows) => {
                  finish();
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-by-non-index",
                          "n-transaction",
                          `index ${i}`,
                        ],
                      })
                    );
                  else {
                    if (resultLengths[i] === undefined) resultLengths[i] = 0;
                    resultLengths[i] += rows.length;

                    if (results[i] === undefined) results[i] = [];
                    results[i].push(...rows);
                    resolve();
                  }
                  addLogRequest.then((logId) => removeLog(logId));
                })
              );
            })
        );
        await Promise.all(partitionRequests);
      }
      // Checksum
      const allLengths = Object.values(resultsLength).sort();
      if (allLengths[0] !== allLengths[allLengths.length - 1]) {
        console.error(
          "[nodeIntegration-sqlite][read-by-non-index][n-transaction] inconsistent result length",
          {
            expected: resultsLength,
            actual: length,
          }
        );
      }
      if (allLengths[0] === 0) {
        console.error(
          `[nodeIntegration-sqlite][read-by-non-index][n-transaction] empty results`
        );
      }

      verifyNonIndexField(results, +count);
    }
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / count;
  }
  //#endregion

  //#region one transaction
  {
    let durations: number[] = [];
    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;
    const start = performance.now();
    const params = [];
    const results: Array<any[]> = [];
    if (PARTITION_MODE) {
      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const finish = () => {
          const end = performance.now();
          durations.push(end - start);
        };
        DB.getConnectionForConv(SELECTED_PARTITION_KEY).then((conn) => {
          conn.serialize((conn) => {
            conn.run("BEGIN TRANSACTION", (error) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "nodeIntegration-sqlite",
                      "read-by-non-index",
                      "1-transaction",
                      "begin-transaction",
                    ],
                  })
                );
            });

            for (let index = 0; index < count; index += 1) {
              const addLogRequest = addLog(
                `[nodeIntegration-sqlite][read-by-non-index][one-transaction] index ${index}`
              );
              conn.all(query, params, (error) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-non-index",
                        "1-transaction",
                        `index ${index}`,
                      ],
                    })
                  );
                } else {
                  // No need to do checksum since we only read from one partition
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
                      "read-by-non-index",
                      "1-transaction",
                      "commit-transaction",
                    ],
                  })
                );
              else resolve();
            });
          });
        });
      });
    } else {
      let resultLengths: Record<number, number> = {};
      const partitionRequests: Promise<void>[] = allPartitionKeys.map(
        (partitionKey) =>
          new Promise((resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
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
                          "read-by-non-index",
                          "1-transaction",
                          "begin-transaction",
                        ],
                      })
                    );
                });

                for (let index = 0; index < count; index += 1) {
                  const addLogRequest = addLog(
                    `[nodeIntegration-sqlite][read-by-non-index][one-transaction] index ${index}`
                  );
                  conn.all(query, params, (error, rows) => {
                    if (error) {
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-non-index",
                            "1-transaction",
                            `index ${index}`,
                          ],
                        })
                      );
                    } else {
                      if (resultLengths[index] === undefined)
                        resultLengths[index] = 0;
                      resultLengths[index] += rows.length;

                      if (results[index] === undefined) {
                        results[index] = [];
                      }
                      results[index].push(
                        ...rows.map(({ status, isErrorInfo }) => ({
                          status,
                          isErrorInfo,
                        }))
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
                          "read-by-non-index",
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
      );

      await Promise.all(partitionRequests);

      const allLengths = Object.values(resultsLength).sort();
      if (allLengths[0] !== allLengths[allLengths.length - 1]) {
        console.error(
          "[nodeIntegration-sqlite][read-by-non-index][one-transaction] inconsistent result length",
          {
            expected: resultsLength,
            actual: length,
          }
        );
      }
      if (allLengths[0] === 0) {
        console.error(
          `[nodeIntegration-sqlite][read-by-non-index][one-transaction] empty results`
        );
      }

      verifyNonIndexField(results, +count);
    }

    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / count;
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
  extraData?: ReadByNonIndexExtraData
): Promise<ReadByNonIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
