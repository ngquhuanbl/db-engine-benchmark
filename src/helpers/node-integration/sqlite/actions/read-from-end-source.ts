import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";
import { addLog, removeLog } from "../../log";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
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
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-from-end-source][n-transaction] read"
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
                    "nodeIntegration-sqlite",
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
                  "[nodeIntegration-sqlite][read-from-end-source][n-transaction] wrong result",
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
    nTransactionAverage = nTransactionSum / readFromEndSourceCount;
  }
  //#endregion

  //#region one transaction
  {
    const results = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = [];
      const addLogRequest = addLog(
        "[nodeIntegration-sqlite][read-from-end-source][one-transaction] read"
      );
      conn.serialize(() => {
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
          const start = performance.now();
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
              const end = performance.now();
              const resultLength = rows.length;
              if (resultLength !== datasetSize) {
                console.error(
                  "[nodeIntegration-sqlite][read-from-end-source][one-transaction] wrong result",
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
                  "read-from-end-source",
                  "1-transaction",
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
    oneTransactionAverage = oneTransactionSum / readFromEndSourceCount;
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
