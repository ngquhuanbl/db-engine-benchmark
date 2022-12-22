import {
  INDEXED_KEYS,
  INDEX_NAME,
  TABLE_NAME,
} from "../../../constants/schema";
import { Action, ReadByIndexExtraData } from "../../../types/action";
import { ReadByIndexResult } from "../../../types/result";
import { escapeStr } from "../../escape-str";
import { patchJSError } from "../../patch-error";
import { openSQLiteDatabase } from "../common";

export const execute: Action<ReadByIndexResult, ReadByIndexExtraData> = async (
  data,
  addLog,
  removeLog,
  { keys } = { keys: [] }
) => {
  const numOfKeys = keys.length;

  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const requests = keys.map((key, index) => {
      const params: any[] = [key];
      const indexedKeyConditions: string[] = [];
      INDEXED_KEYS.forEach((key) => {
        indexedKeyConditions.push(`${escapeStr(key)} =?`);
      });
      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} INDEXED BY ${escapeStr(INDEX_NAME)} WHERE ${indexedKeyConditions.join(
        " AND "
      )}`;
      return new Promise<number>((resolve, reject) => {
        const logId = addLog(
          `[sqlite][read-by-index][n-transaction] index ${index}`
        );
        const start = performance.now();
        conn.all(query, params, (error, rows) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
                  "read-by-index",
                  "n-transaction",
                  `index ${index}`,
                ],
              })
            );
          else {
            const end = performance.now();
            const resultLength = rows.length;
            console.log(resultLength);
            resolve(end - start);
          }
          removeLog(logId);
        });
      });
    });
    const results = await Promise.all(requests);
    nTransactionSum = results.reduce((result, current) => result + current, 0);
    nTransactionAverage = nTransactionSum / numOfKeys;
  }
  //#endregion

  //#region one transaction
  {
    const results: number[] = [];
    await new Promise<void>((resolve, reject) => {
      conn.serialize((conn) => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
                  "read-by-index",
                  "1-transaction",
                  "begin-transaction",
                ],
              })
            );
        });

        for (let index = 0; index < numOfKeys; index += 1) {
          const key = keys[index];
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
          const logId = addLog(
            `[sqlite][read-by-index][one-transaction] index ${index}`
          );
          const start = performance.now();
          conn.all(query, params, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: [
                    "sqlite",
                    "read-by-index",
                    "1-transaction",
                    `index ${index}`,
                  ],
                })
              );
            } else {
              const end = performance.now();
              const resultLength = rows.length;
              console.log(resultLength);
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
                  "sqlite",
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
    oneTransactionSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = oneTransactionSum / numOfKeys;
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
