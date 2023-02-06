import memoize from "fast-memoize";
import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadAllResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { lastOfArray } from "../../../shared/last-of-array";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadAll } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-all][n-transaction] read all");
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    const result: Array<string[]> = [];
    for (let i = 0; i < readAllCount; i += 1) {
      if (window.PARTITION_MODE) {
        const fullname = getTableFullname(window.SELECTED_PARTITION_KEY);
        const transaction = dbInstance.transaction(fullname, "readonly", {
          durability,
        });
        const objectStore = transaction.objectStore(fullname);
        requests.push(
          new Promise<void>(async (resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            if (readUsingBatch) {
              let lastDoc = undefined;
              let done = false;
              let result = [];
              while (done === false) {
                await new Promise<void>((subResolve) => {
                  const range = IDBKeyRange.lowerBound(
                    lastDoc ? lastDoc.msgId : "",
                    true
                  );
                  const openCursorReq = objectStore.getAll(
                    range,
                    readBatchSize
                  );
                  openCursorReq.onerror = function () {
                    reject(
                      patchDOMException(openCursorReq.error!, {
                        tags: ["idb", "read-all", "n-transaction", "batch"],
                      })
                    );
                  };
                  openCursorReq.onsuccess = function () {
                    const subResult = openCursorReq.result;
                    lastDoc = lastOfArray(subResult);
                    if (subResult.length === 0) {
                      done = true;
                      finish();
                      resolve();
                    } else result.concat(subResult);
                    subResolve();
                  };
                });
              }
            } else {
              const readReq = objectStore.getAll();
              readReq.onsuccess = function () {
                finish();
                resolve();

                // const result = readReq.result;
                // const resultLength = result.length;
                // if (resultLength !== datasetSize) {
                //   console.error(
                //     "[idb][read-all][n-transaction] insufficient full traverse",
                //     {
                //       resultLength,
                //       datasetSize,
                //     }
                //   );
                // }
              };
              readReq.onerror = function () {
                finish();
                reject(
                  patchDOMException(readReq.error!, {
                    tags: ["idb", "read-all", "n-transaction"],
                  })
                );
              };
            }
          })
        );
      } else {
        let resultLength = 0;
        const resultByCount: string[] = [];
        const partitionRequests: Promise<void>[] = allPartitionKeys.map(
          (partitionKey) => {
            const fullname = getTableFullname(partitionKey);
            const transaction = dbInstance.transaction(fullname, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(fullname);

            return new Promise<void>(async (resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              if (readUsingBatch) {
                let lastDoc = undefined;
                let done = false;
                let result = [];
                while (done === false) {
                  await new Promise<void>((subResolve) => {
                    const range = IDBKeyRange.lowerBound(
                      lastDoc ? lastDoc.msgId : "",
                      true
                    );
                    const openCursorReq = objectStore.getAll(
                      range,
                      readBatchSize
                    );
                    openCursorReq.onerror = function () {
                      reject(openCursorReq.error!);
                    };
                    openCursorReq.onsuccess = function () {
                      const subResult: { msgId: string }[] =
                        openCursorReq.result;
                      lastDoc = lastOfArray(subResult);
                      if (subResult.length === 0) {
                        done = true;
                        finish();
                        resultLength += result.length;
                        resultByCount.push(...result.map(({ msgId }) => msgId));
                        resolve();
                      } else result.concat(subResult);
                      subResolve();
                    };
                  });
                }
              } else {
                const readReq = objectStore.getAll();
                readReq.onsuccess = function () {
                  finish();
                  resultLength += readReq.result.length;
                  resultByCount.push(
                    ...readReq.result.map(({ msgId }) => msgId)
                  );
                  resolve();
                };
                readReq.onerror = function () {
                  finish();
                  reject(readReq.error);
                };
              }
            });
          }
        );
        requests.push(
          Promise.all(partitionRequests)
            .then(() => {
              if (resultLength !== datasetSize) {
                console.error(
                  "[idb][read-all][n-transaction] insufficient full traverse",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
              result.push(resultByCount);
            })
            .catch((e) => {
              throw patchDOMException(e, {
                tags: ["idb", "read-all", "n-transaction"],
              });
            })
        );
      }
    }
    const start = performance.now();
    await Promise.all(requests).then(() => {
      verifyReadAll(result, datasetSize, readAllCount);
    });
    const end = performance.now();
    nTransactionSum = end - start;
    removeLog(logId);
    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / readAllCount;
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-all][one-transaction] read all");
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
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    const results: Array<string[]> = [];
    for (let i = 0; i < readAllCount; i += 1) {
      if (window.PARTITION_MODE) {
        requests.push(
          new Promise<void>((resolve, reject) => {
            const start = performance.now();
            const finish = () => {
              const end = performance.now();
              durations.push(end - start);
            };
            const objectStore = getObjectStore(window.SELECTED_PARTITION_KEY);
            const readReq = objectStore.getAll();
            readReq.onsuccess = function () {
              //   const result = readReq.result;
              //   const resultLength = result.length;
              //   if (resultLength !== datasetSize) {
              //     console.error(
              //       "[idb][read-all][one-transaction] insufficient full traverse",
              //       {
              //         resultLength,
              //         datasetSize,
              //       }
              //     );
              //   }
              finish();
              resolve();
            };
            readReq.onerror = function () {
              finish();
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-all", "one-transaction"],
                })
              );
            };
          })
        );
      } else {
        let resultLength = 0;
		const subResult: string[] = []
        const partitionRequests: Promise<void>[] = allPartitionKeys.map(
          (partitionKey) => {
            const objectStore = getObjectStore(partitionKey);
            return new Promise<void>((resolve, reject) => {
              const start = performance.now();
              const finish = () => {
                const end = performance.now();
                durations.push(end - start);
              };
              const readReq = objectStore.getAll();
              readReq.onsuccess = function () {
                finish();
                const result = readReq.result;
                resultLength += result.length;
                subResult.push(...result.map(({ msgId }) => msgId));
                resolve();
              };
              readReq.onerror = function () {
                finish();
                reject(readReq.error);
              };
            });
          }
        );
        requests.push(
          Promise.all(partitionRequests)
            .then(() => {
              if (resultLength !== datasetSize) {
                console.error(
                  "[idb][read-all][one-transaction] insufficient full traverse",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
			  results.push(subResult)
            })
            .catch((e) => {
              throw patchDOMException(e, {
                tags: ["idb", "read-all", "one-transaction"],
              });
            })
        );
      }
    }
    const start = performance.now();
    await Promise.all(requests).then(() =>
      verifyReadAll(results, datasetSize, readAllCount)
    );
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = durations.reduce((res, current) => res + current, 0);
    oneTransactionAverage = accumulateSum / readAllCount;

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
  extraData?: ReadAllExtraData
): Promise<ReadAllResult> => {
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
