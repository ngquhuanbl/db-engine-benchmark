import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME, PRIMARY_KEYS } from "../../../../constants/schema";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";

export const execute = async (
  datasetSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-from-end-source][n-transaction] read"
    );
    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} ORDER BY ${PRIMARY_KEYS.map((key) => `${escapeStr(key)} DESC`).join(
      " , "
    )}`;
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          conn.all(query, undefined, (error, rows) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: [
                    "preload-sqlite",
                    "read-from-end-source",
                    "n-transaction",
                  ],
                })
              );
            else {
              const end = performance.now();
              const resultLength = rows.length;
              if (rows.length !== datasetSize) {
                console.error(
                  "[preloaded-sqlite][read-from-end-source][n-transaction] wrong result",
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
    nTransactionAverage = nTransactionSum / readFromEndSourceCount;
  }
  //#endregion

  //#region one transaction
  {
    const results = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = [];
      const logId = addLog(
        "[preloaded-sqlite][read-from-end-source][one-transaction] read"
      );
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
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
          const start = performance.now();
          conn.all(query, undefined, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: [
                    "preload-sqlite",
                    "read-from-end-source",
                    "1-transaction",
                  ],
                })
              );
            } else {
              const end = performance.now();
              const resultLength = rows.length;
              if (resultLength !== datasetSize) {
                console.error(
                  "[preloaded-sqlite][read-from-end-source][one-transaction] wrong result",
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
                  "preload-sqlite",
                  "read-from-end-source",
                  "1-transaction",
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
    oneTransactionAverage = oneTransactionSum / readFromEndSourceCount;
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
