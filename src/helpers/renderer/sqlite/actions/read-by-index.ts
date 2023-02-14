import {
  INDEXED_KEYS,
  TABLE_NAME,
  INDEX_NAME,
} from "../../../../constants/schema";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadByIndexField } from "../../../shared/verify-results";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;

  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(
      `[preloaded-sqlite][read-by-index][n-transaction] read`
    );

    const requestsData: Array<{ query: string; params: any }> = keys.map(
      (key, index) => {
        const params: any[] = [key];
        const indexedKeyConditions: string[] = [];
        INDEXED_KEYS.forEach((key) => {
          indexedKeyConditions.push(`${escapeStr(key)} =?`);
        });
        const query = `SELECT * FROM ${escapeStr(
          TABLE_NAME
        )} INDEXED BY ${escapeStr(
          INDEX_NAME
        )} WHERE ${indexedKeyConditions.join(" AND ")}`;

        return { query, params };
      }
    );

    const checksumData: Array<number> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params }, keyIndex) =>
          new Promise<void>((resolve, reject) => {
            conn.all(query, params, (error, rows) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: ["preload-sqlite", "read-by-index", "n-transaction"],
                  })
                );
              else {
                if (rows) {
                  const resultLength = rows.length;

                  if (checksumData[keyIndex] === undefined)
                    checksumData[keyIndex] = 0;
                  checksumData[keyIndex] += resultLength;
                }
                resolve();
              }
            });
          })
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      `[preloaded-sqlite][read-by-index][one-transaction] read`
    );

    const requestsData: Array<{ query: string; params: any }> = keys.map(
      (key) => {
        const params: any[] = [key];
        const indexedKeyConditions: string[] = [];
        INDEXED_KEYS.forEach((key) => {
          indexedKeyConditions.push(`${escapeStr(key)} =?`);
        });
        const query = `SELECT * FROM ${escapeStr(
          TABLE_NAME
        )} INDEXED BY ${escapeStr(
          INDEX_NAME
        )} WHERE ${indexedKeyConditions.join(" AND ")}`;
        return { query, params };
      }
    );

    const checksumData: Array<number> = [];

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
                  "read-by-index",
                  "1-transaction",
                  "begin-transaction",
                ],
              })
            );
        });

        requestsData.forEach(({ query, params }, keyIndex) => {
          conn.all(query, params, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: ["preload-sqlite", "read-by-index", "1-transaction"],
                })
              );
            } else {
              if (rows) {
                if (checksumData[keyIndex] === undefined)
                  checksumData[keyIndex] = 0;
                checksumData[keyIndex] += rows.length;
              }
            }
          });
        });

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
                  "read-by-index",
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
    oneTransactionAverage = oneTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

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
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
