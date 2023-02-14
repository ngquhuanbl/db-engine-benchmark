import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyReadFromEndSource } from "../../../shared/verify-result";

const originalExecute = async (
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  const DB = DAL.getInstance();

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-from-end-source][n-transaction] read"
    );

    const requestsData: Array<{ partitionKeys: string[] }> = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      if (PARTITION_MODE) {
        requestsData.push({
          partitionKeys: [SELECTED_PARTITION_KEY],
        });
      } else {
        requestsData.push({
          partitionKeys: [...allPartitionKeys],
        });
      }
    }

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} ORDER BY ${PRIMARY_KEYS.map((key) => `${escapeStr(key)} DESC`).join(
      " , "
    )}`;

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ partitionKeys }, countIndex) =>
        Promise.all(
          partitionKeys.map(
            (partitionKey) =>
              new Promise<void>((resolve, reject) => {
                DB.getConnectionForConv(partitionKey).then((conn) => {
                  conn.all(query, undefined, (error, rows) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-from-end-source",
                            "n-transaction",
                          ],
                        })
                      );
                    else {
                      if (checksumData[countIndex] === undefined)
                        checksumData[countIndex] = [];
                      checksumData[countIndex].push(
                        ...rows.map(({ msgId }) => msgId)
                      );
                      resolve();
                    }
                  });
                });
              })
          )
        )
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / readFromEndSourceCount;

    verifyReadFromEndSource(checksumData, datasetSize, readFromEndSourceCount);

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const addLogRequest = addLog(
      "[nodeIntegration-sqlite][read-from-end-source][one-transaction] read"
    );

    const query = `SELECT * FROM ${escapeStr(
      TABLE_NAME
    )} ORDER BY ${PRIMARY_KEYS.map((key) => `${escapeStr(key)} DESC`).join(
      " , "
    )}`;

    const partitionKeys: string[] = [];
    if (PARTITION_MODE) {
      partitionKeys.push(SELECTED_PARTITION_KEY);
    } else {
      partitionKeys.push(...allPartitionKeys);
    }

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<void>((resolve, reject) => {
            DB.getConnectionForConv(partitionKey).then((conn) => {
              conn.serialize((conn) => {
                conn.run("BEGIN TRANSACTION", (error) => {
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-from-end-source",
                          "1-transaction",
                          "begin-transaction",
                        ],
                      })
                    );
                });

                for (let i = 0; i < readFromEndSourceCount; i += 1) {
                  conn.all(query, undefined, (error, rows) => {
                    if (error) {
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-from-end-source",
                            "1-transaction",
                          ],
                        })
                      );
                    } else {
                      if (checksumData[i] === undefined) checksumData[i] = [];
                      checksumData[i].push(...rows.map(({ msgId }) => msgId));
                    }
                  });
                }

                conn.run("COMMIT TRANSACTION", (error) => {
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-from-end-source",
                          "1-transaction",
                          "commit-transaction",
                        ],
                      })
                    );
                  else resolve();
                });
              });
            });
          })
      )
    );
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / readFromEndSourceCount;

    verifyReadFromEndSource(checksumData, datasetSize, readFromEndSourceCount);

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

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
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  extraData?: ReadFromEndSourceExtraData
): Promise<ReadFromEndSourceResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
