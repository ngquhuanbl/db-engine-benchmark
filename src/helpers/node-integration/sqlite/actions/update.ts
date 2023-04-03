import {
  COLUMN_LIST_INFO,
  PRIMARY_KEYS,
  TABLE_NAME,
} from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { UpdateResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { getData, getMsgContentForUpdate } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyUpdateItem } from "../../../shared/verify-results";
import { addLog, removeLog } from "../../log";
import { openSQLiteDatabase, resetSQLiteData } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<UpdateResult> => {
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

  // UPDATE
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][update][n-transaction] write"
    );

    const requestsData: Array<{ query: string; params: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const params: any = [];
      const query = `UPDATE ${escapeStr(TABLE_NAME)} SET ${escapeStr(
        "content"
      )}=? WHERE ${escapeStr("msgId")}=?`;
      params.push(getMsgContentForUpdate(i), jsData.msgId);
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
    const requestsData: Array<{ query: string; params: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const params: any[] = [];
      const primaryKeyConditions: string[] = [];
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(`${escapeStr(key)}=?`);
        params.push(jsData[key]);
      });

      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;
      requestsData.push({ query, params });
    }

    const checksumData: Array<{ msgId: string; content: string }> = [];

    await Promise.all(
      requestsData.map(
        ({ query, params }) =>
          new Promise<void>((resolve, reject) => {
            conn.get(query, params, (error, row) => {
              if (error) {
                reject(
                  patchJSError(error, {
                    tags: ["nodeIntegration-sqlite", "n-transaction", "read"],
                  })
                );
              } else {
                if (row) {
                  checksumData.push({ msgId: row.msgId, content: row.content });
                }
                resolve();
              }
            });
          })
      )
    );

    verifyUpdateItem(checksumData, datasetSize);
  }

  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransaction = -1;

  // WRITE
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][update][one-transaction] write"
    );

    const requestsData: Array<{ query: string; params: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);

      const query = `UPDATE ${escapeStr(TABLE_NAME)} SET ${escapeStr(
        "content"
      )}=? WHERE ${escapeStr("msgId")}=?`;
      const params = [getMsgContentForUpdate(i), jsData.msgId];

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
    const requestsData: Array<{ query: string; params: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const params: any[] = [];
      const primaryKeyConditions: string[] = [];
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(`${escapeStr(key)}=?`);
        params.push(jsData[key]);
      });

      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;
      requestsData.push({ query, params });
    }

    const checksumData: Array<{ msgId: string; content: string }> = [];

    await Promise.all(
      requestsData.map(
        ({ query, params }) =>
          new Promise<void>((resolve, reject) => {
            conn.get(query, params, (error, row) => {
              if (error) {
                reject(
                  patchJSError(error, {
                    tags: ["nodeIntegration-sqlite", "n-transaction", "read"],
                  })
                );
              } else {
                if (row) {
                  checksumData.push({ msgId: row.msgId, content: row.content });
                }
                resolve();
              }
            });
          })
      )
    );

    verifyUpdateItem(checksumData, datasetSize);
  }

  //#endregion

  conn.close((error) => {
    if (error) throw error;
  });

  return {
   nTransaction,
   oneTransaction
  };
};

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<UpdateResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize
  );
};
