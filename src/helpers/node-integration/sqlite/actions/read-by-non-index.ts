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
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-non-index][n-transaction] read`
    );

    const requestsData: Array<{ partitionKeys: string[] }> = [];
    for (let i = 0; i < count; i += 1) {
      if (PARTITION_MODE) {
        requestsData.push({ partitionKeys: [SELECTED_PARTITION_KEY] });
      } else {
        requestsData.push({ partitionKeys: [...allPartitionKeys] });
      }
    }

    const checksumData: Array<
      {
        status: number;
        isErrorInfo: boolean;
      }[]
    > = [];

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;
    const params = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ partitionKeys }, countIndex) =>
        Promise.all(
          partitionKeys.map(
            (partitionKey) =>
              new Promise<void>((resolve, reject) => {
                DB.getConnectionForConv(partitionKey).then((conn) =>
                  conn.all(query, params, (error, rows) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-non-index",
                            "n-transaction",
                          ],
                        })
                      );
                    else {
                      if (rows) {
                        if (checksumData[countIndex] === undefined)
                          checksumData[countIndex] = [];
                        checksumData[countIndex].push(
                          ...rows.map(({ isErrorInfo, status }) => ({
                            isErrorInfo,
                            status,
                          }))
                        );
                      }
                      resolve();
                    }
                  })
                );
              })
          )
        )
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / count;

    verifyNonIndexField(checksumData, count);

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-non-index][one-transaction] read`
    );
    const partitionKeys: string[] = [];
    if (PARTITION_MODE) {
      partitionKeys.push(SELECTED_PARTITION_KEY);
    } else {
      partitionKeys.push(...allPartitionKeys);
    }

    const checksumData: Array<
      {
        status: number;
        isErrorInfo: boolean;
      }[]
    > = [];

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;
    const params = [];

    const start = performance.now();
    await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<void>((resolve, reject) => {
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
                      if (rows) {
                        if (checksumData[index] === undefined) {
                          checksumData[index] = [];
                        }
                        checksumData[index].push(
                          ...rows.map(({ isErrorInfo, status }) => ({
                            isErrorInfo,
                            status,
                          }))
                        );
                      }
                    }
                  });
                }

                conn.run("COMMIT TRANSACTION", (error) => {
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
      )
    );
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / count;

    verifyNonIndexField(checksumData, count);

    addLogRequest.then((logId) => removeLog(logId));
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
