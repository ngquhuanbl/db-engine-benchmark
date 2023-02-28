import {
  INDEXED_KEYS,
  TABLE_NAME,
  INDEX_NAME,
} from "../../../../constants/schema";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchJSError } from "../../../shared/patch-error";
import { verifyReadByIndexField } from "../../../shared/verify-result";
import { openSQLiteDatabase } from "../common";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;
  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  const allPartitionKeys = getAllPossibleConvIds();

  //#region n transaction
  {
    const logId = addLog(
      `[preloaded-sqlite][read-by-index][n-transaction] read`
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
                openSQLiteDatabase(partitionKey).then((conn) => {
                  conn.all(query, params, (error, rows) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "preloaded-sqlite",
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

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(
      `[preloaded-sqlite][read-by-index][one-transaction] read`
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
            openSQLiteDatabase(partitionKey).then((conn) =>
              conn.serialize((conn) => {
                conn.run("BEGIN TRANSACTION", (error) => {
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "preloaded-sqlite",
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
                            "preloaded-sqlite",
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
                          "preloaded-sqlite",
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

    removeLog(logId);
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
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
