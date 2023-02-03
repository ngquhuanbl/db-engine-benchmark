import memoize from "fast-memoize";
import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { limit, count }: ReadByLimitExtraData = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
): Promise<ReadByLimitResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-by-limit][n-transaction] read");
    const durations: number[] = [];
    const requests: Promise<void>[] = [];
    for (let i = 0; i < count; i += 1) {
      if (window.PARTITION_MODE) {
        requests.push(
          new Promise<void>((resolve, reject) => {
            const fullname = getTableFullname(window.SELECTED_PARTITION_KEY);

            const transaction = dbInstance.transaction(fullname, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(fullname);
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const readReq = objectStore.openCursor();
            let resultLength = 0;
            readReq.onsuccess = function () {
              const cursor = readReq.result;
              if (cursor) {
                resultLength += 1;
                if (resultLength === limit) {
                  finish();
                  resolve();
                } else cursor.continue();
              } else {
                finish();
                resolve();
              }
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-limit", "n-transaction"],
                })
              );
            };
          })
        );
      } else {
        requests.push(
          new Promise<void>((resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            let resultLength = 0;
            const length = allPartitionKeys.length;
            function execute(index: number) {
              const partitionKey = allPartitionKeys[index];
              const fullname = getTableFullname(partitionKey);
              const transaction = dbInstance.transaction(fullname, "readonly", {
                durability,
              });
              const objectStore = transaction.objectStore(fullname);
              const readReq = objectStore.openCursor();
              readReq.onsuccess = function () {
                const cursor = readReq.result;
                if (cursor) {
                  resultLength += 1;
                  if (resultLength === limit) {
                    finish();
                    resolve();
                  } else cursor.continue();
                } else {
                  if (resultLength < limit && index < length - 1) {
                    execute(index + 1);
                  } else {
                    finish();
                    resolve();
                  }
                }
              };
              readReq.onerror = function () {
                finish();
                reject(
                  patchDOMException(readReq.error!, {
                    tags: ["idb", "read-by-limit", "n-transaction"],
                  })
                );
              };
            }
            execute(0);
          })
        );
      }
    }
    const start = performance.now();
    await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / count;

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-by-limit][one-transaction] read");
    const allTableFullnames = allPartitionKeys.map((partitionKey) =>
      getTableFullname(partitionKey)
    );
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

    const getObjectStore = memoize((partitionKey: string) => {
      const storeName = getTableFullname(partitionKey);
      return transaction.objectStore(storeName);
    });
    const durations: number[] = [];
    const requests: Promise<void>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        new Promise<void>((resolve, reject) => {
          if (window.PARTITION_MODE) {
            const objectStore = getObjectStore(window.SELECTED_PARTITION_KEY);
            const result = [];
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const readReq = objectStore.openCursor();
            readReq.onsuccess = function () {
              const cursor = readReq.result;
              if (cursor) {
                result.push(cursor.value);
                if (result.length === limit) {
                  finish();
                  resolve();
                } else cursor.continue();
              } else {
                finish();
                resolve();
              }
            };
            readReq.onerror = function () {
              finish();
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-limit", "one-transaction"],
                })
              );
            };
          } else {
            let resultLength = 0;
            const length = allPartitionKeys.length;
            const execute = (index: number) => {
              const partitionKey = allPartitionKeys[index];
              const objectStore = getObjectStore(partitionKey);
              const readReq = objectStore.openCursor();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              readReq.onsuccess = function () {
                const cursor = readReq.result;
                if (cursor) {
                  resultLength += 1;
                  if (resultLength === limit) {
                    finish();
                    resolve();
                  } else cursor.continue();
                } else {
                  if (resultLength < limit && index < length - 1) {
                    execute(index + 1);
                  } else {
                    finish();
                    resolve();
                  }
                }
              };
              readReq.onerror = function () {
                finish();
                reject(
                  patchDOMException(readReq.error!, {
                    tags: ["idb", "read-by-limit", "one-transaction"],
                  })
                );
              };
            };
            execute(0);
          }
        })
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / count;

    removeLog(logId);
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
  extraData?: ReadByLimitExtraData
): Promise<ReadByLimitResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
