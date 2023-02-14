import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";
import { addLog, removeLog } from "../../log";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { getNonIndexConditionSQLite } from "../../../shared/non-index-conditions";
import { verifyNonIndexField } from "../../../shared/verify-results";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  const checkStatement = getNonIndexConditionSQLite();

  // Checksum
  let resultsLength = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-non-index][n-transaction] read`
    );

    const checksumData: Array<{ status: number; isErrorInfo: boolean }[]> = [];

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;

    const start = performance.now();
    await Promise.all(
      Array.from({ length: count }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            conn.all(query, [], (error, rows) => {
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
                  if (checksumData[countIndex] == undefined)
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
            });
          })
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

    const checksumData: Array<{ status: number; isErrorInfo: boolean }[]> = [];

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
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
          conn.all(query, [], (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: [
                    "nodeIntegration-sqlite",
                    "read-by-non-index",
                    "1-transaction",
                  ],
                })
              );
            } else {
              if (rows) {
                if (checksumData[index] === undefined) checksumData[index] = [];
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
      });
    });
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / count;

    verifyNonIndexField(checksumData, count);

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  conn.close((error) => {
    if (error) throw error;
  });

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
