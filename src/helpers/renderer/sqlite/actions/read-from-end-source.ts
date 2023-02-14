import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME, PRIMARY_KEYS } from "../../../../constants/schema";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadFromEndSource } from "../../../shared/verify-results";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
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

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: readFromEndSourceCount }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
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
                if (rows) {
                  if (checksumData[countIndex] === undefined)
                    checksumData[countIndex] = [];
                  checksumData[countIndex].push(
                    ...rows.map(({ msgId }) => msgId)
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
    nTransactionAverage = nTransactionSum / readFromEndSourceCount;

    verifyReadFromEndSource(checksumData, datasetSize, readFromEndSourceCount);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-from-end-source][one-transaction] read"
    );

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} ORDER BY ${PRIMARY_KEYS.map((key) => `${escapeStr(key)} DESC`).join(
      " , "
    )}`;

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
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
              if (rows) {
                if (checksumData[i] === undefined) checksumData[i] = [];
                checksumData[i].push(...rows.map(({ msgId }) => msgId));
              }
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
          else resolve();
        });
      });
    });
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / readFromEndSourceCount;

    verifyReadFromEndSource(checksumData, datasetSize, readFromEndSourceCount);

    removeLog(logId);
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
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadFromEndSourceExtraData
): Promise<ReadFromEndSourceResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
