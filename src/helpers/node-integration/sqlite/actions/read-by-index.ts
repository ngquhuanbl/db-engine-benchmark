import {
  INDEXED_KEYS,
  TABLE_NAME,
  INDEX_NAME,
} from "../../../../constants/schema";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";
import { addLog, removeLog } from "../../log";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
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
        const addLogRequest = addLog(
          `[nodeIntegration-sqlite][read-by-index][n-transaction] index ${index}`
        );
        const start = performance.now();
        conn.all(query, params, (error, rows) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "read-by-index",
                  "n-transaction",
                  `index ${index}`,
                ],
              })
            );
          else {
            const end = performance.now();
            const resultLength = rows.length;
            resolve(end - start);
          }
          addLogRequest.then((logId) => removeLog(logId));
        });
      });
    });
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    nTransactionSum = results.reduce((result, current) => result + current, 0);
    nTransactionAverage = nTransactionSum / numOfKeys;
  }
  //#endregion

  //#region one transaction
  {
    const results: number[] = [];
	const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
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
          const addLogRequest = addLog(
            `[nodeIntegration-sqlite][read-by-index][one-transaction] index ${index}`
          );
          const start = performance.now();
          conn.all(query, params, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: [
                    "nodeIntegration-sqlite",
                    "read-by-index",
                    "1-transaction",
                    `index ${index}`,
                  ],
                })
              );
            } else {
              const end = performance.now();
              results.push(end - start);
            }
            addLogRequest.then((logId) => removeLog(logId));
          });
        }

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
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
	
    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfKeys;
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
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
