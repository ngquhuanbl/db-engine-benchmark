import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadAllResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadAll } from "../../../shared/verify-results";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-all][n-transaction] read all"
    );
    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: readAllCount }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            conn.all(query, undefined, (error, rows) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: ["preload-sqlite", "read-all", "n-transaction"],
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
    nTransactionAverage = nTransactionSum / readAllCount;

    verifyReadAll(checksumData, datasetSize, readAllCount);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-all][one-transaction] read all"
    );

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
                  tags: ["preload-sqlite", "read-all", "1-transaction"],
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
                  "read-all",
                  "1-transaction",
                  "3 ranges",
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
    oneTransactionAverage = oneTransactionSum / readAllCount;

    verifyReadAll(checksumData, datasetSize, readAllCount);

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
  extraData?: ReadAllExtraData
): Promise<ReadAllResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
