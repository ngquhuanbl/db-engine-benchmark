import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadByRange } from "../../../shared/verify-results";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { ranges }: ReadByRangeExtraData = { ranges: [] }
): Promise<ReadByRangeResult> => {
  const numOfRanges = ranges.length;

  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(
      `[preloaded-sqlite][read-by-range][n-transaction] read`
    );

    const requestsData: Array<{ query: string; params: any }> = ranges.map(
      ({ from, to }) => {
        const params: any[] = [from, to];
        const primaryKeyConditions: string[] = [];
        PRIMARY_KEYS.forEach((key) => {
          primaryKeyConditions.push(
            `${escapeStr(key)} >=? AND ${escapeStr(key)} <= ?`
          );
        });
        const query = `SELECT * FROM ${escapeStr(
          TABLE_NAME
        )} WHERE ${primaryKeyConditions.join(" AND ")}`;

        return { query, params };
      }
    );

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params }, rangeIndex) =>
          new Promise<void>((resolve, reject) => {
            conn.all(query, params, (error, rows) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: ["preload-sqlite", "read-by-range", "n-transaction"],
                  })
                );
              else {
                if (rows) {
                  if (checksumData[rangeIndex] === undefined)
                    checksumData[rangeIndex] = [];
                  checksumData[rangeIndex].push(
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
    nTransactionAverage = nTransactionSum / numOfRanges;

    verifyReadByRange(checksumData, ranges);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      `[preloaded-sqlite][read-by-range][one-transaction] read`
    );

    const requestsData: Array<{ query: string; params: any }> = ranges.map(
      ({ from, to }) => {
        const params: any[] = [from, to];
        const primaryKeyConditions: string[] = [];
        PRIMARY_KEYS.forEach((key) => {
          primaryKeyConditions.push(
            `${escapeStr(key)} >=? AND ${escapeStr(key)} <= ?`
          );
        });
        const query = `SELECT * FROM ${escapeStr(
          TABLE_NAME
        )} WHERE ${primaryKeyConditions.join(" AND ")}`;

        return { query, params };
      }
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
                  "read-by-range",
                  "1-transaction",
                  "begin-transaction",
                ],
              })
            );
        });

        requestsData.forEach(({ query, params }, rangeIndex) => {
          conn.all(query, params, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: ["preload-sqlite", "read-by-range", "1-transaction"],
                })
              );
            } else {
              if (rows) {
                if (checksumData[rangeIndex] === undefined)
                  checksumData[rangeIndex] = [];
                checksumData[rangeIndex].push(
                  ...rows.map(({ msgId }) => msgId)
                );
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
                  "read-by-range",
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
    oneTransactionAverage = oneTransactionSum / numOfRanges;

    verifyReadByRange(checksumData, ranges);

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
  extraData?: ReadByRangeExtraData
): Promise<ReadByRangeResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
