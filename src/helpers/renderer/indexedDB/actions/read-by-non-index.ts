import memoize from "fast-memoize";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { Data } from "../../../../types/shared/data";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { getNonIndexConditionForIDB } from "../../../shared/non-index-conditions";
import { patchDOMException } from "../../../shared/patch-error";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";
  const allPartitionKeys = getAllPossibleConvIds();

  const checkFn = getNonIndexConditionForIDB();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  // Checksum
  let resultsLength = -1;

  //#region n transaction
  {
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        window.PARTITION_MODE
          ? new Promise<number>((resolve, reject) => {
              const logId = addLog(
                `[idb][read-by-non-index][n-transaction] ${i}`
              );
              const fullname = getTableFullname(window.SELECTED_PARTITION_KEY);
              const transaction = dbInstance.transaction(fullname, "readonly", {
                durability,
              });
              const objectStore = transaction.objectStore(TABLE_NAME);
              const results: Data[] = [];
              const start = performance.now();
              const openCursorReq = objectStore.openCursor();
              openCursorReq.onerror = function () {
                reject(
                  patchDOMException(openCursorReq.error!, {
                    tags: ["idb", "read-by-non-index", "n-transaction", `${i}`],
                  })
                );
                removeLog(logId);
              };
              openCursorReq.onsuccess = function () {
                const cursor = openCursorReq.result;
                if (cursor) {
                  const value = cursor.value;
                  if (checkFn(value)) results.push(value);
                  cursor.continue();
                } else {
                  const end = performance.now();
                  resolve(end - start);
                  if (resultsLength === -1) resultsLength = results.length;
                  else if (resultsLength !== results.length) {
                    console.error(
                      "[idb][read-by-non-index][n-transaction] inconsistent result length",
                      {
                        expected: resultsLength,
                        actual: results.length,
                      }
                    );
                  }

                  if (results.length === 0) {
                    console.error(
                      "[idb][read-by-non-index][n-transaction] empty result"
                    );
                  }
                  removeLog(logId);
                }
              };
            })
          : (() => {
              const logId = addLog(
                `[idb][read-by-non-index][n-transaction] ${i}`
              );
              const subRequests: Promise<void>[] = [];
              const results: Data[] = [];
              const allTableFullnames = allPartitionKeys.map(getTableFullname);
              const transaction = dbInstance.transaction(
                allTableFullnames,
                "readonly",
                {
                  durability,
                }
              );
              const getObjectStore = (partitionKey: string) => {
                const fullname = getTableFullname(partitionKey);
                return transaction.objectStore(fullname);
              };
              for (const partitionKey of allPartitionKeys) {
                const objectStore = getObjectStore(partitionKey);
                const openCursorReq = objectStore.openCursor();
                subRequests.push(
                  new Promise<void>((resolve, reject) => {
                    openCursorReq.onerror = function () {
                      reject(openCursorReq.error!);
                    };
                    openCursorReq.onsuccess = function () {
                      const cursor = openCursorReq.result;
                      if (cursor) {
                        const value = cursor.value;
                        if (checkFn(value)) results.push(value);
                        cursor.continue();
                      } else {
                        resolve();
                      }
                    };
                  })
                );
              }
              return Promise.all(subRequests)
                .then(() => {
                  const end = performance.now();
				  if (resultsLength === -1) resultsLength = results.length;
                  else if (resultsLength !== results.length) {
                    console.error(
                      "[idb][read-by-non-index][n-transaction] inconsistent result length",
                      {
                        expected: resultsLength,
                        actual: results.length,
                      }
                    );
                  }

                  if (results.length === 0) {
                    console.error(
                      "[idb][read-by-non-index][n-transaction] empty result"
                    );
                  }
                  return end - start;
                })
                .catch((e) => {
                  throw patchDOMException(e, {
                    tags: ["idb", "read-by-non-index", "n-transaction", `${i}`],
                  });
                })
                .finally(() => {
                  removeLog(logId);
                });
            })()
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / count;
  }
  //#endregion

  //#region one transaction
  {
    const allTableFullnames = allPartitionKeys.map(getTableFullname);

    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });
    const getObjectStore = memoize((partitionKey: string) => {
      const storeName = getTableFullname(partitionKey);
      return transaction.objectStore(storeName);
    });

    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        window.PARTITION_MODE
          ? new Promise<number>((resolve, reject) => {
              const logId = addLog(
                `[idb][read-by-non-index][one-transaction] ${i}`
              );
              const objectStore = getObjectStore(window.SELECTED_PARTITION_KEY);
              const results: Data[] = [];
              const start = performance.now();
              const openCursorReq = objectStore.openCursor();
              openCursorReq.onerror = function () {
                reject(
                  patchDOMException(openCursorReq.error!, {
                    tags: ["idb", "read-by-non-index", "one-transaction", `${i}`],
                  })
                );
                removeLog(logId);
              };
              openCursorReq.onsuccess = function () {
                const cursor = openCursorReq.result;
                if (cursor) {
                  const value = cursor.value;
                  if (checkFn(value)) results.push(value);
                  cursor.continue();
                } else {
                  const end = performance.now();
                  resolve(end - start);
                  if (resultsLength === -1) resultsLength = results.length;
                  else if (resultsLength !== results.length) {
                    console.error(
                      "[idb][read-by-non-index][one-transaction] inconsistent result length",
                      {
                        expected: resultsLength,
                        actual: results.length,
                      }
                    );
                  }

                  if (results.length === 0) {
                    console.error(
                      "[idb][read-by-non-index][one-transaction] empty result"
                    );
                  }
                  removeLog(logId);
                }
              };
            })
          : (() => {
              const logId = addLog(
                `[idb][read-by-non-index][one-transaction] ${i}`
              );
              const subRequests: Promise<void>[] = [];
              const results: Data[] = [];
              const getObjectStore = (partitionKey: string) => {
                const fullname = getTableFullname(partitionKey);
                return transaction.objectStore(fullname);
              };
              for (const partitionKey of allPartitionKeys) {
                const objectStore = getObjectStore(partitionKey);
                const openCursorReq = objectStore.openCursor();
                subRequests.push(
                  new Promise<void>((resolve, reject) => {
                    openCursorReq.onerror = function () {
                      reject(openCursorReq.error!);
                    };
                    openCursorReq.onsuccess = function () {
                      const cursor = openCursorReq.result;
                      if (cursor) {
                        const value = cursor.value;
                        if (checkFn(value)) results.push(value);
                        cursor.continue();
                      } else {
                        resolve();
                      }
                    };
                  })
                );
              }
              return Promise.all(subRequests)
                .then(() => {
                  const end = performance.now();
				  if (resultsLength === -1) resultsLength = results.length;
                  else if (resultsLength !== results.length) {
                    console.error(
                      "[idb][read-by-non-index][one-transaction] inconsistent result length",
                      {
                        expected: resultsLength,
                        actual: results.length,
                      }
                    );
                  }

                  if (results.length === 0) {
                    console.error(
                      "[idb][read-by-non-index][one-transaction] empty result"
                    );
                  }
                  return end - start;
                })
                .catch((e) => {
                  throw patchDOMException(e, {
                    tags: ["idb", "read-by-non-index", "one-transaction", `${i}`],
                  });
                })
                .finally(() => {
                  removeLog(logId);
                });
            })()
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / count;
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
  extraData?: ReadByNonIndexExtraData
): Promise<ReadByNonIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
