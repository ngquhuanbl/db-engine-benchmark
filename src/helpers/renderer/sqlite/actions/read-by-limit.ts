import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadByLimit } from "../../../shared/verify-results";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
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
    const logId = addLog(
      "[preloaded-sqlite][read-by-limit][n-transaction] read"
    );

    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)} LIMIT ${limit}`;

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: count }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            conn.all(query, undefined, (error, rows) => {
              if (error)
                reject(
                  patchJSError(error, {
                    tags: ["preload-sqlite", "read-by-limit", "n-transaction"],
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
    nTransactionAverage = nTransactionSum / count;

    verifyReadByLimit(checksumData, count, limit);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      "[preloaded-sqlite][read-by-limit][one-transaction] read"
    );

    const query = `SELECT * FROM ${escapeStr(TABLE_NAME)} LIMIT ${limit}`;

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
                  "read-by-limit",
                  "1-transaction",
                  "begin-transaction",
                ],
              })
            );
        });

        for (let i = 0; i < count; i += 1) {
          conn.all(query, undefined, (error, rows) => {
            if (error) {
              reject(
                patchJSError(error, {
                  tags: ["preload-sqlite", "read-by-limit", "1-transaction"],
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
                  "read-by-limit",
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
    oneTransactionAverage = oneTransactionSum / count;

    verifyReadByLimit(checksumData, count, limit);

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
  extraData?: ReadByLimitExtraData
): Promise<ReadByLimitResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
