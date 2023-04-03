import {
  COLUMN_LIST_INFO,
  PRIMARY_KEYS,
  TABLE_NAME,
} from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DeleteResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { getData, getMsgDeleteMsgId } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyDeleteItem } from "../../../shared/verify-results";
import { addLog, removeLog } from "../../log";
import { openSQLiteDatabase, resetSQLiteData } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<DeleteResult> => {
  const conn = await openSQLiteDatabase();

  async function resetData() {
    async function clearData() {
      const addLogRequest = addLog("[nodeIntegration-sqlite] reset data");
      return resetSQLiteData(conn).finally(() =>
        addLogRequest.then((logId) => removeLog(logId))
      );
    }

    // Reset data
    await clearData();

    // WRITE
    {
      const requestsData: Array<{ query: string; params: any }> = [];
      for (let i = 0; i < datasetSize; i += 1) {
        const jsData = getData(i);
        const params: any = {};
        const fieldList: string[] = [];
        const valuesPlaceholder: string[] = [];
        COLUMN_LIST_INFO.forEach(({ name, type }) => {
          fieldList.push(name);
          valuesPlaceholder.push(`$${name}`);
          const jsValue = jsData[name];

          if (type === "TEXT") {
            if (typeof jsValue !== "string")
              params[`$${name}`] = JSON.stringify(jsValue);
            else params[`$${name}`] = jsValue;
          } else {
            params[`$${name}`] = jsValue;
          }
        });

        const query = `INSERT OR REPLACE INTO ${escapeStr(
          TABLE_NAME
        )} (${fieldList.join(",")}) VALUES (${valuesPlaceholder.join(", ")})`;
        requestsData.push({ query, params });
      }

      await Promise.all(
        requestsData.map(
          ({ query, params }) =>
            new Promise<void>((resolve, reject) => {
              conn.run(query, params, (error) =>
                error
                  ? reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "n-transaction",
                          "write",
                        ],
                      })
                    )
                  : resolve()
              );
            })
        )
      );
    }
  }

  await resetData();

  //#region n transaction
  let nTransaction = -1;

  // DELETE
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][delete][n-transaction] write"
    );

    const msgIdsToDelete = getMsgDeleteMsgId(datasetSize);

    const requestsData: Array<{ query: string; params: any }> = [];

    for (const msgId of msgIdsToDelete) {
      const params: any = [];
      const query = `DELETE FROM ${escapeStr(TABLE_NAME)} WHERE ${escapeStr(
        "msgId"
      )}=?`;
      params.push(msgId);
      requestsData.push({ query, params });
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params }) =>
          new Promise<void>((resolve, reject) => {
            conn.run(query, params, (error) =>
              error
                ? reject(
                    patchJSError(error, {
                      tags: [
                        "nodeIntegration-sqlite",
                        "n-transaction",
                        "write",
                      ],
                    })
                  )
                : resolve()
            );
          })
      )
    );
    const end = performance.now();

    nTransaction = end - start;

    addLogRequest.then((logId) => removeLog(logId));
  }

  // VERIFY
  {
    const query = `SELECT COUNT(*) FROM ${escapeStr(TABLE_NAME)}`;
    const count = await new Promise<number>((resolve, reject) => {
      conn.get(query, [], (error, row) => {
        if (error) {
          reject(
            patchJSError(error, {
              tags: ["nodeIntegration-sqlite", "n-transaction", "verify"],
            })
          );
        } else {
          resolve(row);
        }
      });
    });

    verifyDeleteItem(count);
  }

  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransaction = -1;

  // WRITE
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][delete][one-transaction] write"
    );

    const msgIdsToDelete = getMsgDeleteMsgId(datasetSize);

    const requestsData: Array<{ query: string; params: any }> = [];

    for (const msgId of msgIdsToDelete) {
      const params: any = [];
      const query = `DELETE FROM ${escapeStr(TABLE_NAME)} WHERE ${escapeStr(
        "msgId"
      )}=?`;
      params.push(msgId);
      requestsData.push({ query, params });
    }

    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      conn.serialize(() => {
        conn.run("BEGIN TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "1-transaction",
                  "write",
                  "begin-transaction",
                ],
              })
            );
        });

        requestsData.forEach(({ query, params }) => {
          conn.run(query, params, (error) => {
            if (error)
              reject(
                patchJSError(error, {
                  tags: ["nodeIntegration-sqlite", "1-transaction", "write"],
                })
              );
          });
        });

        conn.run("COMMIT TRANSACTION", (error) => {
          if (error)
            reject(
              patchJSError(error, {
                tags: [
                  "nodeIntegration-sqlite",
                  "1-transaction",
                  "write",
                  "commit-transaction",
                ],
              })
            );
          else resolve();
        });
      });
    });
    const end = performance.now();

    oneTransaction = end - start;

    addLogRequest.then((logId) => removeLog(logId));
  }

  // VERIFY
  {
    const query = `SELECT COUNT(*) FROM ${escapeStr(TABLE_NAME)}`;
    const count = await new Promise<number>((resolve, reject) => {
      conn.get(query, [], (error, row) => {
        if (error) {
          reject(
            patchJSError(error, {
              tags: ["nodeIntegration-sqlite", "n-transaction", "verify"],
            })
          );
        } else {
          resolve(row);
        }
      });
    });

    verifyDeleteItem(count);
  }

  //#endregion

  conn.close((error) => {
    if (error) throw error;
  });

  return {
    nTransaction,
    oneTransaction,
  };
};

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<DeleteResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize
  );
};
