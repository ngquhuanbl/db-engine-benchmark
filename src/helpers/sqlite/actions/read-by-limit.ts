import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../constants/dataset";
import { TABLE_NAME } from "../../../constants/schema";
import { Action, ReadByLimitExtraData } from "../../../types/action";
import { ReadByLimitResult } from "../../../types/result";
import { escapeStr } from "../../escape-str";
import { patchJSError } from "../../patch-error";
import { openSQLiteDatabase } from "../common";

export const execute: Action<ReadByLimitResult, ReadByLimitExtraData> = async (
  data,
  addLog,
  removeLog,
  { limit, count } = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
) => {
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[sqlite][read-by-limit][n-transaction] read");
    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)} LIMIT ${limit}`;
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          conn.all(query, undefined, (error, rows) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["sqlite", "read-by-limit", "n-transaction"],
                })
              );
            else {
              const end = performance.now();
              resolve(end - start);
            }
          });
        })
      );
    }
    const results = await Promise.all(requests);
    removeLog(logId);
    nTransactionSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = nTransactionSum / count;
  }
  //#endregion

  //#region one transaction
  {
    const results = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = [];
      const logId = addLog("[sqlite][read-by-limit][one-transaction] read");
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
                  "read-by-limit",
                  "1-transaction",
                  "begin-transaction",
                ],
              })
            );
        });

        for (let i = 0; i < count; i += 1) {
          const query = `SELECT * FROM ${escapeStr(TABLE_NAME)} LIMIT ${limit}`;
          const start = performance.now();
          conn.all(query, undefined, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: ["sqlite", "read-by-limit", "1-transaction"],
                })
              );
            } else {
              const end = performance.now();
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
                  "read-by-limit",
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
    oneTransactionAverage = oneTransactionSum / count;
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
