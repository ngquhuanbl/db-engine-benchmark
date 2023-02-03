import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { limit, count }: ReadByLimitExtraData = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
): Promise<ReadByLimitResult> => {
  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(
      "[nodeIntegration-sqlite][read-by-limit][n-transaction] read"
    );

    const durations: number[] = [];
    const countRequests: Promise<void>[] = [];
    const resultLengths: Record<number, number> = {};
    for (let i = 0; i < count; i += 1) {
      if (PARTITION_MODE) {
        countRequests.push(
          new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${escapeStr(
              TABLE_NAME
            )} LIMIT ${limit}`;
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            openSQLiteDatabase(SELECTED_PARTITION_KEY).then((conn) =>
              conn.all(query, undefined, (error) => {
                finish();
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-limit",
                        "n-transaction",
                      ],
                    })
                  );
                else {
                  // No need to do checksum since we traverse only one partition
                  resolve();
                }
              })
            );
          })
        );
      } else {
        countRequests.push(
          new Promise<void>((resolve, reject) => {
            let resultLength = 0;
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const execute = (partitionIndex: number) => {
              const partitionKey = allPartitionKeys[partitionIndex];
              const currentLimit = limit - resultLength;
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} LIMIT ${currentLimit}`;
              openSQLiteDatabase(partitionKey).then((conn) => {
                conn.all(query, undefined, (error, rows) => {
                  if (error) {
                    finish();
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-by-limit",
                          "n-transaction",
                        ],
                      })
                    );
                  } else {
                    resultLength += rows.length;
                    if (
                      resultLength === limit ||
                      partitionIndex === allPartitionKeys.length - 1
                    ) {
                      resultLengths[i] = resultLength;
                      finish();
                      resolve();
                    } else execute(partitionIndex + 1);
                  }
                });
              });
            };
            execute(0);
          })
        );
      }
    }
    const start = performance.now();
    await Promise.all(countRequests);
    const end = performance.now();
    nTransactionSum = end - start;

    const allLengths = Object.values(resultLengths);
    if (allLengths[0] !== allLengths[allLengths.length - 1]) {
      console.error(
        "[nodeIntegration-sqlite][read-by-limit][n-transaction] inconsistent result length",
        {
          expected: allLengths[0],
          actual: allLengths[allLengths.length - 1],
        }
      );
    }

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / count;

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      "[nodeIntegration-sqlite][read-by-limit][one-transaction] read"
    );
    let durations: number[] = [];
    let resultLengths: Record<number, number> = {};
    const start = performance.now();
    if (PARTITION_MODE) {
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
                      "nodeIntegration-sqlite",
                      "read-by-limit",
                      "1-transaction",
                      "begin-transaction",
                    ],
                  })
                );
            });

            for (let i = 0; i < count; i += 1) {
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} LIMIT ${limit}`;
              conn.all(query, undefined, (error) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-limit",
                        "1-transaction",
                      ],
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
                      "nodeIntegration-sqlite",
                      "read-by-limit",
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
      await new Promise<void>((resolve, reject) => {
        let resultLength = 0;
        const start = performance.now();
        const finish = () => {
          const end = performance.now();
          durations.push(end - start);
        };
        function execute(partitionIndex: number) {
          const partitionKey = allPartitionKeys[partitionIndex];
          const currentLimit = limit - resultLength;
          openSQLiteDatabase(partitionKey).then((conn) =>
            conn.serialize((conn) => {
              let stop = false;
              conn.run("BEGIN TRANSACTION", (error) => {
                if (error)
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-limit",
                        "1-transaction",
                        "begin-transaction",
                      ],
                    })
                  );
              });

              for (let i = 0; i < count; i += 1) {
                const query = `SELECT * FROM ${escapeStr(
                  TABLE_NAME
                )} LIMIT ${currentLimit}`;
                conn.all(query, undefined, (error, rows) => {
                  if (error) {
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-by-limit",
                          "1-transaction",
                        ],
                      })
                    );
                  } else {
                    if (i === 0) {
                      // Only update once
                      resultLength += rows.length;
                      if (resultLengths[i] === undefined) resultLengths[i] = 0;
                      resultLengths[i] += rows.length;
                    }
                    if (i === count - 1) {
                      if (resultLength < limit && partitionIndex < length - 1) {
                        execute(partitionIndex + 1); // Only schedule once
                      } else stop = true;
                    }
                  }
                });
              }

              conn.run("COMMIT TRANSACTION", (error) => {
                if (stop) finish();
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-limit",
                        "1-transaction",
                        "commit-transaction",
                      ],
                    })
                  );
                } else if (stop) resolve();
              });
            })
          );
        }
        execute(0);
      });
    }

    const allLengths = Object.values(resultLengths).sort();
    if (allLengths[0] !== allLengths[allLengths.length - 1]) {
      console.error(
        "[nodeIntegration-sqlite][read-by-limit][one-transaction] inconsistent result length",
        {
          expected: allLengths[0],
          actual: allLengths[allLengths.length - 1],
        }
      );
    }

    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / count;
    removeLog(logId);
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
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadByLimitExtraData
): Promise<ReadByLimitResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
