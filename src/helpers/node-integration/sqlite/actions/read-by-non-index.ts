import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";
import { addLog, removeLog } from "../../log";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { getNonIndexConditionSQLite } from "../../../shared/non-index-conditions";

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
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${checkStatement}`;
      requests.push(
        new Promise<number>((resolve, reject) => {
          const addLogRequest = addLog(
            `[nodeIntegration-sqlite][read-by-non-index][n-transaction] index ${i}`
          );
          const params = [];
          const start = performance.now();
          conn.all(query, params, (error, rows) => {
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
              const end = performance.now();
              resolve(end - start);
              if (resultsLength === -1) resultsLength = results.length;
              else if (resultsLength !== results.length) {
                console.error(
                  "[nodeIntegration-sqlite][read-by-non-index][n-transaction] inconsistent result length",
                  {
                    expected: resultsLength,
                    actual: results.length,
                  }
                );
              }
              if (results.length === 0) {
                console.error(
                  `[nodeIntegration-sqlite][read-by-non-index][n-transaction] empty results`
                );
              }
            }
            addLogRequest.then((logId) => removeLog(logId));
          });
        })
      );
    }
	const start = performance.now();
    const results = await Promise.all(requests);
	const end = performance.now();
	nTransactionSum = end - start;
	
    const accumulateSum = results.reduce((result, current) => result + current, 0);
    nTransactionAverage = accumulateSum / count;
  }
  //#endregion

  //#region one transaction
  {
    const results: number[] = [];
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
          const params: any[] = [];
          const query = `SELECT * FROM ${escapeStr(
            TABLE_NAME
          )} WHERE ${checkStatement}`;
          const addLogRequest = addLog(
            `[nodeIntegration-sqlite][read-by-non-index][one-transaction] index ${index}`
          );
          const start = performance.now();
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
              const end = performance.now();
              results.push(end - start);
              if (resultsLength === -1) resultsLength = results.length;
              else if (resultsLength !== results.length) {
                console.error(
                  "[nodeIntegration-sqlite][read-by-non-index][one-transaction] inconsistent result length",
                  {
                    expected: resultsLength,
                    actual: results.length,
                  }
                );
              }
              if (results.length === 0) {
                console.error(
                  `[nodeIntegration-sqlite][read-by-non-index][one-transaction] empty results`
                );
              }
            }
            addLogRequest.then((logId) => removeLog(logId));
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
	
    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / count;
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
