import { PRIMARY_KEYS, TABLE_NAME } from "../../../constants/schema";
import { Action } from "../../../types/action";
import { ReadByRangeResult } from "../../../types/result";
import { calculateRange } from "../../calculate-range";
import { checkChecksum } from "../../check-checksum";
import { escapeStr } from "../../escape-str";
import { patchJSError } from "../../patch-error";
import { openSQLiteDatabase } from "../common";

export const execute: Action<ReadByRangeResult> = async (
  data,
  addLog,
  removeLog
) => {
  const conn = await openSQLiteDatabase();

  const [startRange, middleRange, endRange] = calculateRange(data.length);

  let nTransactionStartRange = -1;
  let nTransactionMiddleRange = -1;
  let nTransactionEndRange = -1;
  let oneTransactionStartRange = -1;
  let oneTransactionMiddleRange = -1;
  let oneTransactionEndRange = -1;

  let startRangeChecksum = 0;
  let middleRangeChecksum = 0;
  let endRangeChecksum = 0;

  //#region n transaction
  {
    const logId = addLog("[sqlite][read-by-range][n-transaction] start range");
    const { from, to } = startRange;
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
    let start = performance.now();
	let end = -1;
    startRangeChecksum = await new Promise<number>((resolve, reject) => {
      conn.all(query, params, (error, rows) => {
        if (error)
          reject(
            patchJSError(error, {
              tags: ["sqlite", "read-by-range", "n-transaction", "start range"],
            })
          );
        else {
			end = performance.now();
			resolve(rows.length);
		}
      });
    });
    
    removeLog(logId);
    nTransactionStartRange = end - start;
  }

  {
    const logId = addLog("[sqlite][read-by-range][n-transaction] middle range");
    const { from, to } = middleRange;
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
    let start = performance.now();
	let end = -1;
    middleRangeChecksum = await new Promise<number>((resolve, reject) => {
      conn.all(query, params, (error, rows) => {
        if (error)
          reject(
            patchJSError(error, {
              tags: [
                "sqlite",
                "read-by-range",
                "n-transaction",
                "middle range",
              ],
            })
          );
        else {
			end = performance.now();
			resolve(rows.length);
		}
      });
    });
    removeLog(logId);
    nTransactionMiddleRange = end - start;
  }

  {
    const logId = addLog("[sqlite][read-by-range][n-transaction] end range");
    const { from, to } = endRange;
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
    let start = performance.now();
	let end = -1;
    endRangeChecksum = await new Promise<number>((resolve, reject) => {
      conn.all(query, params, (error, rows) => {
        if (error)
          reject(
            patchJSError(error, {
              tags: ["sqlite", "read-by-range", "n-transaction", "end range"],
            })
          );
        else {
			end = performance.now();
			resolve(rows.length);
		}
      });
    });
    removeLog(logId);
    nTransactionEndRange = end - start;
  }
  //#endregion

  // Check checksum
  if (
    !checkChecksum(
      [startRangeChecksum, middleRangeChecksum, endRangeChecksum],
      data.length
    )
  ) {
    const checksum =
      startRangeChecksum + middleRangeChecksum + endRangeChecksum;
    console.error(`[sqlite][read-by-range][n-transaction] unmatched checksum`, {
      checksum,
      datasetSize: data.length,
      startRangeChecksum,
      middleRangeChecksum,
      endRangeChecksum,
    });
  }

  // Reset checksum
  startRangeChecksum = 0;
  middleRangeChecksum = 0;
  endRangeChecksum = 0;

  //#region one transaction
  await new Promise<void>((resolve, reject) => {
    conn.serialize((conn) => {
      conn.run("BEGIN TRANSACTION", (error) => {
        if (error)
          reject(
            patchJSError(error, {
              tags: [
                "sqlite",
                "read-by-range",
                "1-transaction",
                "3 ranges",
                "begin-transaction",
              ],
            })
          );
      });

      {
        const { from, to } = startRange;
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
          "[sqlite][read-by-range][one-transaction] start range"
        );
        let start = performance.now();
        conn.all(query, params, (error, rows) => {
          if (error) {
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
                  "read-by-range",
                  "1-transaction",
                  "start range",
                ],
              })
            );
          } else {
            startRangeChecksum = rows.length;
            let end = performance.now();
            oneTransactionStartRange = end - start;
          }
          removeLog(logId);
        });
      }

      {
        const { from, to } = middleRange;
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
          "[sqlite][read-by-range][one-transaction] middle range"
        );
        let start = performance.now();
        conn.all(query, params, (error, rows) => {
          if (error) {
            reject(
              patchJSError(error, {
                tags: [
                  "sqlite",
                  "read-by-range",
                  "1-transaction",
                  "middle range",
                ],
              })
            );
          } else {
            middleRangeChecksum = rows.length;
            let end = performance.now();
            oneTransactionMiddleRange = end - start;
          }
          removeLog(logId);
        });
      }

      {
        const { from, to } = endRange;
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
          "[sqlite][read-by-range][one-transaction] end range"
        );
        let start = performance.now();
        conn.all(query, params, (error, rows) => {
          if (error) {
            reject(
              patchJSError(error, {
                tags: ["sqlite", "read-by-range", "1-transaction", "end range"],
              })
            );
          } else {
            endRangeChecksum = rows.length;
            let end = performance.now();
            oneTransactionEndRange = end - start;
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
                "read-by-range",
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
  //#endregion

  // Check checksum
  if (
    !checkChecksum(
      [startRangeChecksum, middleRangeChecksum, endRangeChecksum],
      data.length
    )
  ) {
    const checksum =
      startRangeChecksum + middleRangeChecksum + endRangeChecksum;
    console.error(`[sqlite][read-by-range][1-transaction] unmatched checksum`, {
      checksum,
      datasetSize: data.length,
      startRangeChecksum,
      middleRangeChecksum,
      endRangeChecksum,
    });
  }

  conn.close((error) => {
    if (error) throw error;
  });
  
  return {
    nTransactionStartRange,
    nTransactionMiddleRange,
    nTransactionEndRange,
    oneTransactionStartRange,
    oneTransactionMiddleRange,
    oneTransactionEndRange,
  };
};
