import {
  INDEXED_KEYS,
  TABLE_NAME,
  INDEX_NAME,
} from "../../../../constants/schema";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyReadByIndexField } from "../../../shared/verify-result";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;

  const DB = DAL.getInstance();

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-index][n-transaction] read`
    );

    const requestsData: Array<{
      partitionKeys: string[];
      query: string;
      params: any;
    }> = [];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const params: any[] = [JSON.stringify(key)];
      const indexedKeyConditions: string[] = [];
      INDEXED_KEYS.forEach((key) => {
        indexedKeyConditions.push(`${escapeStr(key)} =?`);
      });
      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} INDEXED BY ${escapeStr(INDEX_NAME)} WHERE ${indexedKeyConditions.join(
        " AND "
      )}`;
      if (PARTITION_MODE) {
        requestsData.push({
          partitionKeys: [SELECTED_PARTITION_KEY],
          query,
          params,
        });
      } else {
        requestsData.push({ partitionKeys: allPartitionKeys, query, params });
      }
    }

    const checksumData: number[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ partitionKeys, query, params }, keyIndex) =>
        Promise.all(
          partitionKeys.map(
            (partitionKey) =>
              new Promise<void>((resolve, reject) => {
                DB.getConnectionForConv(partitionKey).then((conn) => {
                  conn.all(query, params, (error, rows) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-index",
                            "n-transaction",
                          ],
                        })
                      );
                    else {
                      if (rows) {
                        if (checksumData[keyIndex] === undefined)
                          checksumData[keyIndex] = 0;
                        checksumData[keyIndex] += rows.length;
                      }
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
    nTransactionAverage = nTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-index][one-transaction] read`
    );

    const partitionKeys: string[] = [];
    if (PARTITION_MODE) {
      partitionKeys.push(SELECTED_PARTITION_KEY);
    } else {
      partitionKeys.push(...allPartitionKeys);
    }

    const data: Array<{ query: string; params: any }> = [];
    for (let index = 0; index < numOfKeys; index += 1) {
      const key = keys[index];
      const params: any[] = [JSON.stringify(key)];
      const indexedKeyConditions: string[] = [];
      INDEXED_KEYS.forEach((key) => {
        indexedKeyConditions.push(`${escapeStr(key)} =?`);
      });
      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} INDEXED BY ${escapeStr(INDEX_NAME)} WHERE ${indexedKeyConditions.join(
        " AND "
      )}`;

      data.push({ query, params });
    }

    const checksumData: number[] = [];

    const start = performance.now();
    await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<void>((resolve, reject) => {
            DB.getConnectionForConv(partitionKey).then((conn) =>
              conn.serialize((conn) => {
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

                data.forEach(({ query, params }, keyIndex) => {
                  conn.all(query, params, (error, rows) => {
                    if (error) {
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-index",
                            "1-transaction",
                          ],
                        })
                      );
                    } else {
                      if (rows) {
                        if (checksumData[keyIndex] === undefined)
                          checksumData[keyIndex] = 0;
                        checksumData[keyIndex] += rows.length;
                      }
                    }
                  });
                });

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
              })
            );
          })
      )
    );
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

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
