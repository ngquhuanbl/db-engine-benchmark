import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyReadFromEndSource } from "../../../shared/verify-result";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  const DB = DAL.getInstance();

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-from-end-source][n-transaction] read"
    );
    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} ORDER BY ${PRIMARY_KEYS.map((key) => `${escapeStr(key)} DESC`).join(
      " , "
    )}`;
    const durations: number[] = [];
    const countRequests: Promise<void>[] = [];
    const results: Array<string[]> = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      if (PARTITION_MODE) {
        countRequests.push(
          new Promise((resolve, reject) => {
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
                        "read-from-end-source",
                        "n-transaction",
                      ],
                    })
                  );
                else {
                  // No need to do checksum since we only traverse one partition
                  resolve();
                }
              })
            );
          })
        );
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
              DB.getConnectionForConv(partitionKey).then((conn) => {
                conn.all(query, undefined, (error, rows) => {
                  finish();
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-from-end-source",
                          "n-transaction",
                        ],
                      })
                    );
                  else {
                    resultLength += rows.length;
                    if (results[i] === undefined) results[i] = [];
                    results[i].push(...rows.map(({ msgId }) => msgId));
                    resolve();
                  }
                });
              });
            })
        );
        countRequests.push(
          Promise.all(partitionRequests).then(() => {
            if (resultLength !== datasetSize) {
              console.error(
                "[nodeIntegration-sqlite][read-from-end-source][n-transaction] insufficient full traverse",
                {
                  resultLength,
                  datasetSize,
                }
              );
            }
          })
        );
      }
    }
    const start = performance.now();
    await Promise.all(countRequests).then(() => {
		verifyReadFromEndSource(results, datasetSize, +readFromEndSourceCount)
	});
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / readFromEndSourceCount;

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const durations: number[] = [];
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-from-end-source][one-transaction] read"
    );
	const results: Array<string[]> = [];
    const start = performance.now();
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
                      "read-from-end-source",
                      "1-transaction",
                      "begin-transaction",
                    ],
                  })
                );
            });

            for (let i = 0; i < readFromEndSourceCount; i += 1) {
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} ORDER BY ${PRIMARY_KEYS.map(
                (key) => `${escapeStr(key)} DESC`
              ).join(" , ")}`;
              conn.all(query, undefined, (error) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "read-from-end-source",
                        "1-transaction",
                      ],
                    })
                  );
                } else {
                  // No need to do checksum since we only visit one partition
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
                      "read-from-end-source",
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
            DB.getConnectionForConv(partitionKey).then((conn) => {
              conn.serialize((conn) => {
                conn.run("BEGIN TRANSACTION", (error) => {
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-from-end-source",
                          "1-transaction",
                          "begin-transaction",
                        ],
                      })
                    );
                });

                for (let i = 0; i < readFromEndSourceCount; i += 1) {
                  const query = `SELECT * FROM ${escapeStr(
                    TABLE_NAME
                  )} ORDER BY ${PRIMARY_KEYS.map(
                    (key) => `${escapeStr(key)} DESC`
                  ).join(" , ")}`;
                  conn.all(query, undefined, (error, rows) => {
                    if (error) {
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-from-end-source",
                            "1-transaction",
                          ],
                        })
                      );
                    } else {
                      if (resultLengths[i] === undefined) resultLengths[i] = 0;
                      resultLengths[i] += rows.length;
					  
					  if (results[i] === undefined) results[i] = [];
					  results[i].push(...rows.map(({ msgId }) => msgId))
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
                          "read-from-end-source",
                          "1-transaction",
                          "commit-transaction",
                        ],
                      })
                    );
                  else resolve();
                });
              });
            });
          })
      );
      await Promise.all(partitionRequests);

      for (const resultLength of Object.values(resultLengths)) {
        if (resultLength !== datasetSize) {
          console.error(
            "[nodeIntegration-sqlite][read-from-end-source][n-transaction] insufficient full traverse",
            {
              resultLength,
              datasetSize,
            }
          );
        }
      }
	  
	  verifyReadFromEndSource(results, datasetSize, +readFromEndSourceCount)
    }

    addLogRequest.then((logId) => removeLog(logId));
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / readFromEndSourceCount;
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
  extraData?: ReadFromEndSourceExtraData
): Promise<ReadFromEndSourceResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
