import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadAllResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";
import { addLog, removeLog } from "../../log";
import { ReadAllExtraData } from "../../../../types/shared/action";

export const execute = async (
  datasetSize: number,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      "[preloaded-sqlite][read-all][n-transaction] read all"
    );
    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readAllCount; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          conn.all(query, undefined, (error, rows) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["nodeIntegration-sqlite", "read-all", "n-transaction"],
                })
              );
            else {
              const end = performance.now();
              const resultLength = rows.length;
              if (rows.length !== datasetSize) {
                console.error(
                  "[preloaded-sqlite][read-all][n-transaction] wrong result",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
              resolve(end - start);
            }
          });
        })
      );
    }
    const results = await Promise.all(requests);
    addLogRequest.then((logId) => removeLog(logId));
    nTransactionSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = nTransactionSum / readAllCount;
  }
  //#endregion

  //#region one transaction
  {
    const results = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = [];
      const addLogRequest = addLog(
        "[preloaded-sqlite][read-all][one-transaction] read all"
      );
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
          const start = performance.now();
          conn.all(query, undefined, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: ["nodeIntegration-sqlite", "read-all", "1-transaction"],
                })
              );
            } else {
              const end = performance.now();
              const resultLength = rows.length;
              if (resultLength !== datasetSize) {
                console.error(
                  "[preloaded-sqlite][read-all][one-transaction] wrong result",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
              results.push(end - start);
            }
          });
        }

        conn.run("COMMIT TRANSACTION", (error) => {
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
          else resolve(results);
          addLogRequest.then((logId) => removeLog(logId));
        });
      });
    });
    oneTransactionSum = results.reduce((res, current) => res + current, 0);
    oneTransactionAverage = oneTransactionSum / readAllCount;
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
