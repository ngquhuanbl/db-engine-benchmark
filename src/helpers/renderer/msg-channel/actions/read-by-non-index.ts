import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { getNonIndexConditionSQLite } from "../../../shared/non-index-conditions";
import { patchJSError } from "../../../shared/patch-error";
import { verifyNonIndexField } from "../../../shared/verify-result";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  const allPartitionKeys = getAllPossibleConvIds();

  const checkStatement = getNonIndexConditionSQLite();

  //#region n transaction
  {
    const logId = addLog(
      `[websocket-sqlite][read-by-non-index][n-transaction] read`
    );

    const requestsData: Array<{ partitionKeys: string[] }> = [];
    for (let i = 0; i < count; i += 1) {
      if (PARTITION_MODE) {
        requestsData.push({ partitionKeys: [SELECTED_PARTITION_KEY] });
      } else {
        requestsData.push({ partitionKeys: [...allPartitionKeys] });
      }
    }

    const checksumData: Array<
      {
        status: number;
        isErrorInfo: boolean;
      }[]
    > = [];

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} WHERE ${checkStatement}`;
    const params = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ partitionKeys }, countIndex) =>
        Promise.all(
          partitionKeys.map(
            (partitionKey) =>
              new Promise<void>((resolve, reject) => {
                openSQLiteDatabase(partitionKey).then((conn) =>
                  conn.all(query, params, (error, rows) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "websocket-sqlite",
                            "read-by-non-index",
                            "n-transaction",
                          ],
                        })
                      );
                    else {
                      if (rows) {
                        if (checksumData[countIndex] === undefined)
                          checksumData[countIndex] = [];
                        checksumData[countIndex].push(
                          ...rows.map(({ isErrorInfo, status }) => ({
                            isErrorInfo,
                            status,
                          }))
                        );
                      }
                      resolve();
                    }
                  })
                );
              })
          )
        )
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / count;

    verifyNonIndexField(checksumData, count);

    removeLog(logId);
  }
  //#endregion

//   //#region one transaction
//   {
//     const logId = addLog(
//       `[websocket-sqlite][read-by-non-index][one-transaction] read`
//     );
//     const partitionKeys: string[] = [];
//     if (PARTITION_MODE) {
//       partitionKeys.push(SELECTED_PARTITION_KEY);
//     } else {
//       partitionKeys.push(...allPartitionKeys);
//     }

//     const checksumData: Array<
//       {
//         status: number;
//         isErrorInfo: boolean;
//       }[]
//     > = [];

//     const query = `SELECT * FROM ${escapeStr(
//       TABLE_NAME
//     )} WHERE ${checkStatement}`;
//     const params = [];

//     const start = performance.now();
//     await Promise.all(
//       partitionKeys.map(
//         (partitionKey) =>
//           new Promise<void>((resolve, reject) => {
//             openSQLiteDatabase(partitionKey).then((conn) =>
//               conn.serialize((conn) => {
//                 conn.run("BEGIN TRANSACTION", (error) => {
//                   if (error)
//                     reject(
//                       patchJSError(error, {
//                         tags: [
//                           "websocket-sqlite",
//                           "read-by-non-index",
//                           "1-transaction",
//                           "begin-transaction",
//                         ],
//                       })
//                     );
//                 });

//                 for (let index = 0; index < count; index += 1) {
//                   conn.all(query, params, (error, rows) => {
//                     if (error) {
//                       reject(
//                         patchJSError(error, {
//                           tags: [
//                             "websocket-sqlite",
//                             "read-by-non-index",
//                             "1-transaction",
//                             `index ${index}`,
//                           ],
//                         })
//                       );
//                     } else {
//                       if (rows) {
//                         if (checksumData[index] === undefined) {
//                           checksumData[index] = [];
//                         }
//                         checksumData[index].push(
//                           ...rows.map(({ isErrorInfo, status }) => ({
//                             isErrorInfo,
//                             status,
//                           }))
//                         );
//                       }
//                     }
//                   });
//                 }

//                 conn.run("COMMIT TRANSACTION", (error) => {
//                   if (error)
//                     reject(
//                       patchJSError(error, {
//                         tags: [
//                           "websocket-sqlite",
//                           "read-by-non-index",
//                           "1-transaction",
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
//     oneTransactionSum = end - start;
//     oneTransactionAverage = oneTransactionSum / count;

//     verifyNonIndexField(checksumData, count);

//     removeLog(logId);
//   }
//   //#endregion

  //   conn.close((error) => {
  //     if (error) throw error;
  //   });

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
  extraData?: ReadByNonIndexExtraData
): Promise<ReadByNonIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
