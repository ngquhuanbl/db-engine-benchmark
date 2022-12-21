import { MIN_READ_ALL_COUNT } from "../../../constants/dataset";
import { TABLE_NAME } from "../../../constants/schema";
import { Action, ReadAllExtraData } from "../../../types/action";
import { ReadAllResult } from "../../../types/result";
import { escapeStr } from "../../escape-str";
import { patchJSError } from "../../patch-error";
import { openSQLiteDatabase } from "../common";

export const execute: Action<ReadAllResult, ReadAllExtraData> = async (
  data,
  addLog,
  removeLog,
  { readAllCount } = { readAllCount: MIN_READ_ALL_COUNT }
) => {
  const datasetSize = data.length;
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[sqlite][read-all][n-transaction] read all");
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
                  tags: ["sqlite", "read-all", "n-transaction"],
                })
              );
            else {
              const end = performance.now();
              const resultLength = rows.length;
              if (rows.length !== datasetSize) {
                console.error(
                  "[sqlite][read-all][n-transaction] wrong result",
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
    removeLog(logId);
    nTransactionSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = nTransactionSum / readAllCount;
  }
  //#endregion

  //#region one transaction
  {
    const results = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = [];
      const logId = addLog("[sqlite][read-all][one-transaction] read all");
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
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
                  tags: ["sqlite", "read-all", "1-transaction"],
                })
              );
            } else {
              const end = performance.now();
              const resultLength = rows.length;
              if (resultLength !== datasetSize) {
                console.error(
                  "[sqlite][read-all][one-transaction] wrong result",
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
                  "sqlite",
                  "read-all",
                  "1-transaction",
                  "3 ranges",
                  "commit-transaction",
                ],
              })
            );
          else resolve(results);
          removeLog(logId);
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
