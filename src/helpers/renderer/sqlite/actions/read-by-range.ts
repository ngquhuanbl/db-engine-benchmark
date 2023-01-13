import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
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
    const requests = ranges.map(({ from, to }, index) => {
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
      return new Promise<number>((resolve, reject) => {
        const logId = addLog(
          `[preloaded-sqlite][read-by-range][n-transaction] range ${index}`
        );
        const start = performance.now();
        conn.all(query, params, (error, rows) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "preload-sqlite",
                  "read-by-range",
                  "n-transaction",
                  `range ${index}`,
                ],
              })
            );
          else {
            const end = performance.now();
            const resultLength = rows.length;
            const size = +to - +from + 1;
            if (size !== resultLength) {
              console.error(
                `[preloaded-sqlite][read-by-range][n-transaction] range ${index} - unmatched checksum`,
                {
                  from,
                  to,
                  resultLength,
                  size,
                }
              );
            }
            resolve(end - start);
          }
          removeLog(logId);
        });
      });
    });
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / numOfRanges;
  }
  //#endregion

  //#region one transaction
  {
    const results: number[] = [];
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

        for (let index = 0; index < numOfRanges; index += 1) {
          const { from, to } = ranges[index];
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
          const logId = addLog(
            `[preloaded-sqlite][read-by-range][one-transaction] range ${index}`
          );
          const start = performance.now();
          conn.all(query, params, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: [
                    "preload-sqlite",
                    "read-by-range",
                    "1-transaction",
                    `range ${index}`,
                  ],
                })
              );
            } else {
              const end = performance.now();
              const resultLength = rows.length;
              const size = +to - +from + 1;
              if (size !== resultLength) {
                console.error(
                  `[preloaded-sqlite][read-by-range][1-transaction] range ${index} - unmatched checksum`,
                  {
                    from,
                    to,
                    resultLength,
                    size,
                  }
                );
              }
              results.push(end - start);
            }
            removeLog(logId);
          });
        }

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

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfRanges;
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
