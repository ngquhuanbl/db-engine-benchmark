import { COLUMN_LIST_INFO, TABLE_NAME } from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DeleteResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import {
  getAllPossibleConvIds,
  getData,
  getMsgContentForUpdate,
} from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyUpdateItem } from "../../../shared/verify-result";
import { openSQLiteDatabase, resetSQLiteData } from "../common";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<DeleteResult> => {
  const allPartitionKeys = getAllPossibleConvIds();

  let partitionKeys: string[] = [];
  if (PARTITION_MODE) {
    partitionKeys = [SELECTED_PARTITION_KEY];
  } else {
    partitionKeys = [...allPartitionKeys];
  }

  async function resetData() {
    async function clearData() {
      const logId = addLog("[msg-channel-sqlite] reset data");
      return resetSQLiteData().finally(() =>
        removeLog(logId)
      );
    }

    // Reset data
    await clearData();

    // WRITE
    {
      const requestsData: Array<{
        query: string;
        params: any;
        partitionKey: string;
      }> = [];
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
        const partitionKey = jsData.toUid;
        if (allPartitionKeys.includes(partitionKey)) {
          requestsData.push({ query, params, partitionKey });
        }
      }

      await Promise.all(
        requestsData.map(
          ({ query, params, partitionKey }) =>
            new Promise<void>((resolve, reject) => {
              openSQLiteDatabase(partitionKey).then((conn) =>
                conn.run(query, params, (error) =>
                  error
                    ? reject(
                        patchJSError(error, {
                          tags: [
                            "msg-channel-sqlite",
                            "n-transaction",
                            "write",
                          ],
                        })
                      )
                    : resolve()
                )
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
    const logId = addLog(
      "[msg-channel-sqlite][update][n-transaction] write"
    );

    const requestsData: Array<{
      query: string;
      params: any;
      partitionKey: string;
    }> = [];

    for (let i = 0; i < datasetSize; i += 1) {
      const jsData = getData(i);
      const partitionKey = jsData.toUid;
      if (!partitionKeys.includes(partitionKey)) continue;

      const params: any = [];
      const query = `UPDATE ${escapeStr(TABLE_NAME)} SET ${escapeStr(
        "content"
      )}=? WHERE ${escapeStr("msgId")}=?`;
      params.push(getMsgContentForUpdate(i), jsData.msgId);
      requestsData.push({ query, params, partitionKey });
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ query, params, partitionKey }) =>
          new Promise<void>((resolve, reject) => {
            openSQLiteDatabase(partitionKey).then((conn) =>
              conn.run(query, params, (error) =>
                error
                  ? reject(
                      patchJSError(error, {
                        tags: [
                          "msg-channel-sqlite",
                          "n-transaction",
                          "write",
                        ],
                      })
                    )
                  : resolve()
              )
            );
          })
      )
    );
    const end = performance.now();

    nTransaction = end - start;

    removeLog(logId);
  }

  // VERIFY
  {
    const checksumData: any[] = [];
    await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<void>((resolve, reject) => {
            openSQLiteDatabase(partitionKey).then((conn) => {
              const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
              conn.all(query, [], (error, rows) => {
                if (error) {
                  reject(
                    patchJSError(error, {
                      tags: [
                        "msg-channel-sqlite",
                        "n-transaction",
                        "verify",
                      ],
                    })
                  );
                } else {
                  const data = rows || [];
                  checksumData.push(...data);
                  resolve();
                }
              });
            });
          })
      )
    );

    verifyUpdateItem(checksumData, datasetSize);
  }

  //#endregion

//   // Reset data
//   await resetData();

//   //#region one transaction
//   let oneTransaction = -1;

//   // WRITE
//   {
//     const logId = addLog(
//       "[msg-channel-sqlite][update][one-transaction] write"
//     );

//     const groupByConvId: Record<string, { query: string; params: any }[]> = {};
//     for (let i = 0; i < datasetSize; i += 1) {
//       const { msgId, toUid } = getData(i);
//       if (allPartitionKeys.includes(toUid)) {
//         if (groupByConvId[toUid] === undefined) {
//           groupByConvId[toUid] = [];
//         }

//         groupByConvId[toUid].push({
//           query: `UPDATE ${escapeStr(TABLE_NAME)} SET ${escapeStr(
//             "content"
//           )}=? WHERE ${escapeStr("msgId")}=?`,
//           params: [getMsgContentForUpdate(i), msgId],
//         });
//       }
//     }

//     const requestsData: Array<[string, { query: string; params: any }[]]> =
//       Object.entries(groupByConvId);

//     const start = performance.now();
//     await Promise.all(
//       requestsData.map(
//         ([partitionKey, data]) =>
//           new Promise<void>((resolve, reject) => {
//             openSQLiteDatabase(partitionKey).then((conn) =>
//               conn.serialize(() => {
//                 conn.run("BEGIN TRANSACTION", (error) => {
//                   if (error)
//                     reject(
//                       patchJSError(error, {
//                         tags: [
//                           "msg-channel-sqlite",
//                           "1-transaction",
//                           "write",
//                           "begin-transaction",
//                         ],
//                       })
//                     );
//                 });

//                 data.forEach(({ query, params }) => {
//                   conn.run(query, params, (error) => {
//                     if (error)
//                       reject(
//                         patchJSError(error, {
//                           tags: [
//                             "msg-channel-sqlite",
//                             "1-transaction",
//                             "write",
//                           ],
//                         })
//                       );
//                   });
//                 });

//                 conn.run("COMMIT TRANSACTION", (error) => {
//                   if (error)
//                     reject(
//                       patchJSError(error, {
//                         tags: [
//                           "msg-channel-sqlite",
//                           "1-transaction",
//                           "write",
//                           "commit-transaction",
//                         ],
//                       })
//                     );
//                   else resolve();
//                 });
//               })
//             );
//           })
//       )
//     );
//     const end = performance.now();

//     oneTransaction = end - start;

//     removeLog(logId);
//   }

//   // VERIFY
//   {
//     const checksumData: any[] = [];
//     await Promise.all(
//       partitionKeys.map(
//         (partitionKey) =>
//           new Promise<void>((resolve, reject) => {
//             openSQLiteDatabase(partitionKey).then((conn) => {
//               const query = `SELECT * FROM ${escapeStr(TABLE_NAME)}`;
//               conn.all(query, [], (error, rows) => {
//                 if (error) {
//                   reject(
//                     patchJSError(error, {
//                       tags: [
//                         "msg-channel-sqlite",
//                         "n-transaction",
//                         "verify",
//                       ],
//                     })
//                   );
//                 } else {
//                   const data = rows || [];
//                   checksumData.push(...data);
//                   resolve();
//                 }
//               });
//             });
//           })
//       )
//     );

//     verifyUpdateItem(checksumData, datasetSize);
//   }

  //#endregion

  //   conn.close((error) => {
  //     if (error) throw error;
  //   });

  return {
    nTransaction,
    oneTransaction: -1,
  };
};

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<DeleteResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
	addLog,
	removeLog
  );
};