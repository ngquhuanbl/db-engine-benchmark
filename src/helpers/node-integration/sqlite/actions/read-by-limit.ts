import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { openSQLiteDatabase } from "../common";
import { addLog, removeLog } from "../../log";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { limit, count }: ReadByLimitExtraData = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
): Promise<ReadByLimitResult> => {
  const conn = await openSQLiteDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-by-limit][n-transaction] read"
    );
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
                  tags: [
                    "nodeIntegration-sqlite",
                    "read-by-limit",
                    "n-transaction",
                  ],
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
	const start = performance.now();
    const results = await Promise.all(requests);
	const end = performance.now();
	nTransactionSum = end - start;
	
    const accumulateSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / count;
	
    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const start = performance.now();
    const results = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = [];
      const addLogRequest = addLog(
        "[nodeIntegration-sqlite][read-by-limit][one-transaction] read"
      );
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
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
                  tags: [
                    "nodeIntegration-sqlite",
                    "read-by-limit",
                    "1-transaction",
                  ],
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
                  "nodeIntegration-sqlite",
                  "read-by-limit",
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
	const end = performance.now();
	oneTransactionSum = end - start;
	
    const accumulateSum = results.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / count;
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
  extraData?: ReadByLimitExtraData
): Promise<ReadByLimitResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
