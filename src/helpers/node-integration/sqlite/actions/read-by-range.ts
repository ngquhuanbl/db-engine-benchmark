import { PRIMARY_KEYS, TABLE_NAME } from "../../../../constants/schema";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { escapeStr } from "../../../shared/escape-str";
import { patchJSError } from "../../../shared/patch-error";
import { addLog, removeLog } from "../../log";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DAL } from "../library";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { verifyReadByRange } from "../../../shared/verify-result";

const originalExecute = async (
  readUsingBatch: boolean,
  readBatchSize: number,
  { ranges }: ReadByRangeExtraData = { ranges: [] }
): Promise<ReadByRangeResult> => {
  const numOfRanges = ranges.length;

  const DB = DAL.getInstance();

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-range][n-transaction] read`
    );

    const requestsData: Array<{
      partitionKeys: string[];
      query: string;
      params: any;
    }> = [];
    for (const { from, to } of ranges) {
      let partitionKeys: string[] = [];
      if (PARTITION_MODE) {
        partitionKeys = [SELECTED_PARTITION_KEY];
      } else {
        partitionKeys = [...allPartitionKeys];
      }
      const primaryKeyConditions: string[] = [];
      PRIMARY_KEYS.forEach((key) => {
        primaryKeyConditions.push(
          `${escapeStr(key)} >=? AND ${escapeStr(key)} <= ?`
        );
      });
      const query = `SELECT * FROM ${escapeStr(
        TABLE_NAME
      )} WHERE ${primaryKeyConditions.join(" AND ")}`;
      const params = [from, to];
      requestsData.push({
        partitionKeys,
        query,
        params,
      });
    }

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ partitionKeys, query, params }, rangeIndex) =>
        Promise.all(
          partitionKeys.map(
            (partitionKey) =>
              new Promise<void>((resolve, reject) => {
                DB.getConnectionForConv(partitionKey).then((conn) =>
                  conn.all(query, params, (error, rows) => {
                    if (error)
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-range",
                            "n-transaction",
                          ],
                        })
                      );
                    else {
                      if (checksumData[rangeIndex] === undefined)
                        checksumData[rangeIndex] = [];
                      checksumData[rangeIndex].push(
                        ...rows.map(({ msgId }) => msgId)
                      );
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
    nTransactionAverage = nTransactionSum / numOfRanges;

    verifyReadByRange(checksumData, ranges);

    addLogRequest.then((logId) => removeLog(logId));
  }
  //#endregion

  //#region one transaction
  {
    const addLogRequest = addLog(
      `[nodeIntegration-sqlite][read-by-range][one-transaction] read`
    );

    const partitionKeys: string[] = [];
    if (PARTITION_MODE) {
      partitionKeys.push(SELECTED_PARTITION_KEY);
    } else {
      partitionKeys.push(...allPartitionKeys);
    }

    const data: Array<{ query: string; params: any }> = [];
    for (let index = 0; index < numOfRanges; index += 1) {
      const { from, to } = ranges[index];
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
      data.push({ query, params });
    }

    const checksumData: Array<string[]> = [];

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
                          "read-by-range",
                          "1-transaction",
                          "begin-transaction",
                        ],
                      })
                    );
                });

                data.forEach(({ query, params }, rangeIndex) => {
                  conn.all(query, params, (error, rows) => {
                    if (error) {
                      reject(
                        patchJSError(error, {
                          tags: [
                            "nodeIntegration-sqlite",
                            "read-by-range",
                            "1-transaction",
                          ],
                        })
                      );
                    } else {
                      if (checksumData[rangeIndex] === undefined)
                        checksumData[rangeIndex] = [];
                      checksumData[rangeIndex].push(
                        ...rows.map(({ msgId }) => msgId)
                      );
                    }
                  });
                });

                conn.run("COMMIT TRANSACTION", (error) => {
                  if (error)
                    reject(
                      patchJSError(error, {
                        tags: [
                          "nodeIntegration-sqlite",
                          "read-by-range",
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
    oneTransactionAverage = oneTransactionSum / numOfRanges;

    verifyReadByRange(checksumData, ranges);
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
  extraData?: ReadByRangeExtraData
): Promise<ReadByRangeResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    readUsingBatch,
    readBatchSize,
    extraData
  );
};
