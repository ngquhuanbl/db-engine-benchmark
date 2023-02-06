import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyReadByRange } from "../../../shared/verify-result";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { ranges }: ReadByRangeExtraData = { ranges: [] }
): Promise<ReadByRangeResult> => {
  const numOfRanges = ranges.length;

  const DB = DAL.getInstance();

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const durations: number[] = [];
    const primaryKeyConditions: string[] = [];
    PRIMARY_KEYS.forEach((key) => {
      primaryKeyConditions.push(
        `${escapeStr(key)} >=? AND ${escapeStr(key)} <= ?`
      );
    });
    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${primaryKeyConditions.join(" AND ")}`;
    const results: Array<string[]> = [];
    const rangeRequests = ranges.map(({ from, to }, index) => {
      const params = [from, to];
      const addLogRequest = addLog(
        `[nodeIntegration-sqlite][read-by-range][n-transaction] range ${index}`
      );
      if (PARTITION_MODE) {
        return new Promise<void>((resolve, reject) => {
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
                      "read-by-range",
                      "n-transaction",
                      `range ${index}`,
                    ],
                  })
                );
              else {
                resolve();
              }
              addLogRequest.then((logId) => removeLog(logId));
            })
          );
        });
      } else {
        let resultLength = 0;
        const partitionRequests = allPartitionKeys.map(
          (partitionKey) =>
            new Promise<void>((resolve, reject) => {
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
                          "read-by-range",
                          "n-transaction",
                          `range ${index}`,
                        ],
                      })
                    );
                  else {
                    resultLength += rows.length;
                    if (results[index] === undefined) results[index] = [];
                    results[index].push(...rows.map(({ msgId }) => msgId));
                    resolve();
                  }
                  addLogRequest.then((logId) => removeLog(logId));
                })
              );
            })
        );
        return Promise.all(partitionRequests).then(() => {
          const size = +to - +from + 1;
          if (size !== resultLength) {
            console.error(
              `[nodeIntegration-sqlite][read-by-range][n-transaction] range ${index} - unmatched checksum`,
              {
                from,
                to,
                resultLength,
                size,
              }
            );
          }
        });
      }
    });
    const start = performance.now();
    await Promise.all(rangeRequests).then(() => {
      verifyReadByRange(results, ranges);
    });
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / numOfRanges;
  }
  //#endregion

  //#region one transaction
  {
    const start = performance.now();
    let durations: number[] = [];
    const results: Array<string[]> = [];
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
                      "read-by-range",
                      "1-transaction",
                      "begin-transaction",
                    ],
                  })
                );
            });

            for (let index = 0; index < numOfRanges; index += 1) {
              const { from, to } = ranges[index];
              const params: any[] = [from, to];
              const primaryKeyConditions: string[] = [];
              PRIMARY_KEYS.forEach((key) => {
                primaryKeyConditions.push(
                  `${escapeStr(key)} >=? AND ${escapeStr(key)} <= ?`
                );
              });
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} WHERE ${primaryKeyConditions.join(" AND ")}`;
              const addLogRequest = addLog(
                `[nodeIntegration-sqlite][read-by-range][one-transaction] range ${index}`
              );
              conn.all(query, params, (error, rows) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-by-range",
                        "1-transaction",
                        `range ${index}`,
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
                      "read-by-range",
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
      let resultLengths: Record<number, number> = {};
      const partitionRequests = allPartitionKeys.map(
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
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-by-range",
                          "1-transaction",
                          "begin-transaction",
                        ],
                      })
                    );
                });

                for (let index = 0; index < numOfRanges; index += 1) {
                  const { from, to } = ranges[index];
                  const params: any[] = [from, to];
                  const primaryKeyConditions: string[] = [];
                  PRIMARY_KEYS.forEach((key) => {
                    primaryKeyConditions.push(
                      `${escapeStr(key)} >=? AND ${escapeStr(key)} <= ?`
                    );
                  });
                  const query = `SELECT * FROM ${escapeStr(
                    TABLE_NAME
                  )} WHERE ${primaryKeyConditions.join(" AND ")}`;
                  const addLogRequest = addLog(
                    `[nodeIntegration-sqlite][read-by-range][one-transaction] range ${index}`
                  );
                  conn.all(query, params, (error, rows) => {
                    if (error) {
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-range",
                            "1-transaction",
                            `range ${index}`,
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
                      results[index].push(...rows.map(({ msgId }) => msgId));
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
                          "read-by-range",
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
      for (const [rangeIndex, resultLength] of Object.entries(resultLengths)) {
        const { from, to } = ranges[rangeIndex];
        const size = +to - +from + 1;
        if (size !== resultLength) {
          console.error(
            `[nodeIntegration-sqlite][read-by-range][1-transaction] range ${rangeIndex} - unmatched checksum`,
            {
              from,
              to,
              resultLength,
              size,
            }
          );
        }
      }
    }
    const end = performance.now();
    oneTransactionSum = end - start;

    verifyReadByRange(results, ranges);

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfRanges;
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
  extraData?: ReadByRangeExtraData
): Promise<ReadByRangeResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
