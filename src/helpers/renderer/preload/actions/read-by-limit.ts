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
import { verifyReadByLimit } from "../../../shared/verify-result";
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
      "[preloaded-sqlite][read-by-limit][n-transaction] read"
    );

    const requestsData: Array<{ partitionKeys: string[] }> = [];
    for (let i = 0; i < count; i += 1) {
      if (PARTITION_MODE) {
        requestsData.push({ partitionKeys: [SELECTED_PARTITION_KEY] });
      } else {
        requestsData.push({ partitionKeys: [...allPartitionKeys] });
      }
    }

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ partitionKeys }, countIndex) =>
          new Promise<void>((resolve, reject) => {
            let resultLength = 0;
            const execute = (partitionIndex: number) => {
              const partitionKey = partitionKeys[partitionIndex];
              const currentLimit = limit - resultLength;
              const query = `SELECT * FROM ${escapeStr(
                TABLE_NAME
              )} LIMIT ${currentLimit}`;
              openSQLiteDatabase(partitionKey).then((conn) => {
                conn.all(query, undefined, (error, rows) => {
                  if (error) {
                    reject(
                      patchJSError(error, {
                        tags: [
                          "preloaded-sqlite",
                          "read-by-limit",
                          "n-transaction",
                        ],
                      })
                    );
                  } else {
                    resultLength += rows.length;
                    if (checksumData[countIndex] === undefined)
                      checksumData[countIndex] = [];
                    checksumData[countIndex].push(
                      ...rows.map(({ msgId }) => msgId)
                    );

                    if (
                      resultLength === limit ||
                      partitionIndex === partitionKeys.length - 1
                    ) {
                      resolve();
                    } else execute(partitionIndex + 1);
                  }
                });
              });
            };
            execute(0);
          })
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / count;

    verifyReadByLimit(checksumData, count, limit);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-by-limit][one-transaction] read"
    );
    const partitionKeys: string[] = [];
    if (PARTITION_MODE) partitionKeys.push(SELECTED_PARTITION_KEY);
    else partitionKeys.push(...allPartitionKeys);

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      let resultLength = 0;
      function execute(partitionIndex: number) {
        const partitionKey = partitionKeys[partitionIndex];
        const currentLimit = limit - resultLength;
        openSQLiteDatabase(partitionKey).then((conn) =>
          conn.serialize((conn) => {
            let stop = false;
            conn.run("BEGIN TRANSACTION", (error) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: [
                      "preloaded-sqlite",
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
                        "preloaded-sqlite",
                        "read-by-limit",
                        "1-transaction",
                      ],
                    })
                  );
                } else {
                  if (checksumData[i] === undefined) checksumData[i] = [];
                  checksumData[i].push(...rows.map(({ msgId }) => msgId));

                  if (i === 0) {
                    // Only update once
                    resultLength += rows.length;
                  }
                  if (i === count - 1) {
                    if (
                      resultLength < limit &&
                      partitionIndex < partitionKeys.length - 1
                    ) {
                      execute(partitionIndex + 1); // Only schedule once
                    } else stop = true;
                  }
                }
              });
            }

            conn.run("COMMIT TRANSACTION", (error) => {
              if (error) {
                reject(
                  patchJSError(error, {
                    tags: [
                      "preloaded-sqlite",
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
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / count;

    verifyReadByLimit(checksumData, count, limit);

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
