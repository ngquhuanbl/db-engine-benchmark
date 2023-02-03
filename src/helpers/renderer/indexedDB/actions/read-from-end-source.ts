import memoize from "fast-memoize";
import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";

import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();
  const allTableFullnames = allPartitionKeys.map(getTableFullname);

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-from-end-source][n-transaction] read");
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      if (PARTITION_MODE) {
        requests.push(
          new Promise<void>((resolve, reject) => {
            const fullname = getTableFullname(SELECTED_PARTITION_KEY);
            const transaction = dbInstance.transaction(fullname, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(fullname);
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const readReq = objectStore.openCursor(undefined, "prev");
            const result = [];
            readReq.onsuccess = function () {
              const cursor = readReq.result;
              if (cursor) {
                result.push(cursor.value);
                cursor.continue();
              } else {
                finish();
                resolve();
              }
            };
            readReq.onerror = function () {
              finish();
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-from-end-source", "n-transaction"],
                })
              );
            };
          })
        );
      } else {
        const transaction = dbInstance.transaction(allTableFullnames);
        const getObjectStore = (partitionKey: string) => {
          const fullname = getTableFullname(partitionKey);
          return transaction.objectStore(fullname);
        };

        let resultLength = 0;
        const start = performance.now();
        const request = Promise.all(
          allPartitionKeys.map((paritionKey) => {
            const objectStore = getObjectStore(paritionKey);
            return new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              const readReq = objectStore.openCursor(undefined, "prev");
              readReq.onsuccess = function () {
                const cursor = readReq.result;
                if (cursor) {
                  resultLength += 1;
                  cursor.continue();
                } else {
                  finish();
                  resolve();
                }
              };
              readReq.onerror = function () {
                finish();
                reject(readReq.error);
              };
            });
          })
        )
          .then(() => {
            if (resultLength !== datasetSize) {
              console.error(
                "[idb][read-from-end-source][n-transaction] insufficient full traverse",
                {
                  resultLength,
                  datasetSize,
                }
              );
            }
          })
          .catch((e) => {
            throw patchDOMException(e!, {
              tags: ["idb", "read-from-end-source", "n-transaction"],
            });
          });

        requests.push(request);
      }
    }
    const start = performance.now();
    await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / readFromEndSourceCount;

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-from-end-source][one-transaction] read");
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });
    const getObjectStore = memoize((partitionKey) => {
      const fullname = getTableFullname(partitionKey);
      return transaction.objectStore(fullname);
    });
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      if (PARTITION_MODE) {
        requests.push(
          new Promise<void>((resolve, reject) => {
            const objectStore = getObjectStore(SELECTED_PARTITION_KEY);
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const readReq = objectStore.openCursor(undefined, "prev");
            readReq.onsuccess = function () {
              const cursor = readReq.result;
              if (cursor) {
                cursor.continue();
              } else {
                // const resultLength = result.length;
                // if (resultLength !== datasetSize) {
                //   console.error(
                //     "[idb][read-from-end-source][one-transaction] insufficient full traverse",
                //     {
                //       resultLength,
                //       datasetSize,
                //     }
                //   );
                // }
                finish();
                resolve();
              }
            };
            readReq.onerror = function () {
              finish();
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-from-end-source", "one-transaction"],
                })
              );
            };
          })
        );
      } else {
        let resultLength = 0;
        const request = Promise.all(
          allPartitionKeys.map((paritionKey) => {
            const objectStore = getObjectStore(paritionKey);
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const readReq = objectStore.openCursor(undefined, "prev");
            return new Promise<void>((resolve, reject) => {
              readReq.onsuccess = function () {
                const cursor = readReq.result;
                if (cursor) {
                  resultLength += 1;
                  cursor.continue();
                } else {
                  finish();
                  resolve();
                }
              };
              readReq.onerror = function () {
                finish();
                reject(readReq.error);
              };
            });
          })
        )
          .then(() => {
            if (resultLength !== datasetSize) {
              console.error(
                "[idb][read-from-end-source][one-transaction] insufficient full traverse",
                {
                  resultLength,
                  datasetSize,
                }
              );
            }
          })
          .catch((e) => {
            throw patchDOMException(e!, {
              tags: ["idb", "read-from-end-source", "one-transaction"],
            });
          });

        requests.push(request);
      }
    }
    const start = performance.now();
    await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / readFromEndSourceCount;

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
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadFromEndSourceExtraData
): Promise<ReadFromEndSourceResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
