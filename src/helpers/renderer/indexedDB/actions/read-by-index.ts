import memoize from "fast-memoize";
import { INDEX_NAME } from "../../../../constants/schema";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const durations: number[] = [];
    const requests = keys.map((key, index) => {
      const logId = addLog(
        `[idb][read-by-index][n-transaction] index ${index}`
      );
      if (window.PARTITION_MODE) {
        const fullname = getTableFullname(window.SELECTED_PARTITION_KEY);
        const transaction = dbInstance.transaction(fullname, "readonly", {
          durability,
        });
        return new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const objectStore = transaction.objectStore(fullname);
          const indexObj = objectStore.index(INDEX_NAME);
          const readReq = indexObj.getAll(key);
          readReq.onsuccess = function () {
            finish();
            resolve();
          };
          readReq.onerror = function () {
            finish();
            reject(
              patchDOMException(readReq.error, {
                tags: [
                  "idb",
                  "read-by-index",
                  "n-transaction",
                  `index ${index}`,
                ],
              })
            );
          };
        }).finally(() => removeLog(logId));
      } else {
        const partitionRequests: Promise<void>[] = allPartitionKeys.map(
          (partitionKey) => {
            const fullname = getTableFullname(partitionKey);
            const transaction = dbInstance.transaction(fullname, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(fullname);
            return new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              const indexObj = objectStore.index(INDEX_NAME);
              const readReq = indexObj.getAll(key);
              readReq.onsuccess = function () {
                finish();
                resolve();
              };
              readReq.onerror = function () {
                finish();
                reject(readReq.error!);
              };
            });
          }
        );
        return Promise.all(partitionRequests)
          .catch((e) => {
            throw patchDOMException(e, {
              tags: ["idb", "read-by-index", "n-transaction", `index ${index}`],
            });
          })
          .finally(() => {
            removeLog(logId);
          });
      }
    });
    const start = performance.now();
    await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / numOfKeys;
  }
  //#endregion

  //#region one transaction
  {
    const allPartitionKeys = getAllPossibleConvIds();
    const allTableFullnames = allPartitionKeys.map((partitionKey) =>
      getTableFullname(partitionKey)
    );
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });
    const getIndexObj = memoize((partitionKey: string) => {
      const storeName = getTableFullname(partitionKey);
      return transaction.objectStore(storeName).index(INDEX_NAME);
    });
    const durations: number[] = [];
    const requests = keys.map((key, index) => {
      const logId = addLog(
        `[idb][read-by-index][one-transaction] index ${index}`
      );
      if (window.PARTITION_MODE) {
        const indexObj = getIndexObj(window.SELECTED_PARTITION_KEY);
        return new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const readReq = indexObj.getAll(key);
          readReq.onsuccess = function () {
            finish();
            resolve();
          };
          readReq.onerror = function () {
            finish();
            reject(
              patchDOMException(readReq.error, {
                tags: [
                  "idb",
                  "read-by-index",
                  "one-transaction",
                  `index ${index}`,
                ],
              })
            );
          };
        }).finally(() => removeLog(logId));
      } else {
        const partitionRequets: Promise<void>[] = allPartitionKeys.map(
          (partitionKey) => {
            const indexObj = getIndexObj(partitionKey);
            return new Promise((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              const readReq = indexObj.getAll(key);
              readReq.onsuccess = function () {
                finish();
                resolve();
              };
              readReq.onerror = function () {
                finish();
                reject(
                  patchDOMException(readReq.error!, {
                    tags: [
                      "idb",
                      "read-by-index",
                      "one-transaction",
                      `index ${index}`,
                    ],
                  })
                );
              };
            });
          }
        );
        return Promise.all(partitionRequets)
          .catch((e) => {
            throw patchDOMException(e, {
              tags: [
                "idb",
                "read-by-index",
                "one-transaction",
                `index ${index}`,
              ],
            });
          })
          .finally(() => {
            removeLog(logId);
          });
      }
    });
    const start = performance.now();
    await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfKeys;
  }
  //#endregion

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};

export const execute = async (
  benchmarkCount: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
