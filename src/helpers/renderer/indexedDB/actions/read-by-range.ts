import memoize from "fast-memoize";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByRange } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { ranges }: ReadByRangeExtraData = { ranges: [] }
): Promise<ReadByRangeResult> => {
  const numOfRanges = ranges.length;
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
    const results: Array<string[]> = [];
    const requests = ranges.map(({ from, to }, index) => {
      if (PARTITION_MODE) {
        return new Promise<void>((resolve, reject) => {
          const logId = addLog(
            `[idb][read-by-range][n-transaction] range ${index}`
          );
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
          const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
          readReq.onsuccess = function () {
            // const result = readReq.result;
            // const resultLength = result.length;
            // const size = +to - +from + 1;
            // if (size !== resultLength) {
            //   console.error(
            //     `[idb][read-by-range][n-transaction] range ${index} - unmatched checksum`,
            //     {
            //       from,
            //       to,
            //       resultLength,
            //       size,
            //     }
            //   );
            // }
            finish();
            resolve();
            removeLog(logId);
          };
          readReq.onerror = function () {
            finish();
            reject(
              patchDOMException(readReq.error!, {
                tags: [
                  "idb",
                  "read-by-range",
                  "n-transaction",
                  `range ${index}`,
                ],
              })
            );
            removeLog(logId);
          };
        });
      } else {
        const logId = addLog(
          `[idb][read-by-range][n-transaction] range ${index}`
        );
        const allTableFullnames = allPartitionKeys.map(getTableFullname);
        const transaction = dbInstance.transaction(
          allTableFullnames,
          "readonly",
          {
            durability,
          }
        );
        const getObjectStore = memoize((paritionKey) => {
          const fullnamme = getTableFullname(paritionKey);
          return transaction.objectStore(fullnamme);
        });

        let resultLength = 0;
        return Promise.all(
          allPartitionKeys.map((partitionKey) => {
            const objectStore = getObjectStore(partitionKey);
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
            return new Promise<void>((resolve, reject) => {
              readReq.onsuccess = function () {
                finish();
                resultLength += readReq.result.length;

                if (results[index] === undefined) results[index] = [];
                results[index].push(
                  ...readReq.result.map(({ msgId }) => msgId)
                );
                resolve();
              };
              readReq.onerror = function (e) {
                finish();
                reject(e);
              };
            });
          })
        )
          .then(() => {
            const size = +to - +from + 1;
            if (size !== resultLength) {
              console.error(
                `[idb][read-by-range][n-transaction] range ${index} - unmatched checksum`,
                {
                  from,
                  to,
                  resultLength,
                  size,
                }
              );
            }
          })
          .catch((e) => {
            throw patchDOMException(e, {
              tags: ["idb", "read-by-range", "n-transaction", `range ${index}`],
            });
          })
          .finally(() => {
            removeLog(logId);
          });
      }
    });
    const start = performance.now();
    await Promise.all(requests).then(() => {
      verifyReadByRange(results, ranges);
    });
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / numOfRanges;
  }
  //#endregion

  //#region one transaction
  {
    const allTableFullnames = allPartitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });
    const getObjectStore = (paritionKey: string) => {
      const fullname = getTableFullname(paritionKey);
      return transaction.objectStore(fullname);
    };
    const durations: number[] = [];
    const results: Array<string[]> = [];
    const requests = ranges.map(({ from, to }, index) => {
      if (PARTITION_MODE) {
        const logId = addLog(
          `[idb][read-by-range][one-transaction] range ${index}`
        );
        return new Promise<void>((resolve, reject) => {
          const objectStore = getObjectStore(SELECTED_PARTITION_KEY);
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
          readReq.onsuccess = function () {
            // const result = readReq.result;
            // const resultLength = result.length;
            // const size = +to - +from + 1;
            // if (size !== resultLength) {
            //   console.error(
            //     `[idb][read-by-range][one-transaction] range ${index} - unmatched checksum`,
            //     {
            //       from,
            //       to,
            //       resultLength,
            //       size,
            //     }
            //   );
            // }
            finish();
            resolve();
            removeLog(logId);
          };
          readReq.onerror = function () {
            finish();
            reject(
              patchDOMException(readReq.error!, {
                tags: [
                  "idb",
                  "read-by-range",
                  "one-transaction",
                  `range ${index}`,
                ],
              })
            );
            removeLog(logId);
          };
        });
      } else {
        const logId = addLog(
          `[idb][read-by-range][one-transaction] range ${index}`
        );
        let resultLength = 0;
        return Promise.all(
          allPartitionKeys.map((partitionKey) => {
            const objectStore = getObjectStore(partitionKey);
            return new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
              readReq.onsuccess = function () {
                finish();
                resultLength += readReq.result.length;
                if (results[index] === undefined) results[index] = [];
                results[index].push(
                  ...readReq.result.map(({ msgId }) => msgId)
                );
                resolve();
              };
              readReq.onerror = function (e) {
                finish();
                reject(e);
              };
            });
          })
        )
          .then(() => {
            const size = +to - +from + 1;
            if (size !== resultLength) {
              console.error(
                `[idb][read-by-range][one-transaction] range ${index} - unmatched checksum`,
                {
                  from,
                  to,
                  resultLength,
                  size,
                }
              );
            }
            const end = performance.now();
            return end - start;
          })
          .catch((e) => {
            throw patchDOMException(e, {
              tags: [
                "idb",
                "read-by-range",
                "one-transaction",
                `range ${index}`,
              ],
            });
          })
          .finally(() => {
            removeLog(logId);
          });
      }
    });
    const start = performance.now();
    await Promise.all(requests).then(() => {
      verifyReadByRange(results, ranges);
    });
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfRanges;
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
  extraData?: ReadByRangeExtraData
): Promise<ReadByRangeResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
