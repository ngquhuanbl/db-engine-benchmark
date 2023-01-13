import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadAllResult } from "../../../../types/shared/result";
import { lastOfArray } from "../../../shared/last-of-array";
import { patchDOMException } from "../../../shared/patch-error";
import { openIndexedDBDatabase } from "../common";

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

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-all][n-transaction] read all");
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readAllCount; i += 1) {
      const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
        durability,
      });
      const objectStore = transaction.objectStore(TABLE_NAME);
      requests.push(
        new Promise<number>(async (resolve, reject) => {
          const start = performance.now();
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
                const openCursorReq = objectStore.getAll(range, readBatchSize);
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
                    const end = performance.now();

                    const resultLength = result.length;
                    if (resultLength !== datasetSize) {
                      console.error(
                        "[idb][read-all][n-transaction][batch] insufficient full traverse",
                        {
                          resultLength,
                          datasetSize,
                        }
                      );
                    }
                    resolve(end - start);
                  } else result.concat(subResult);
                  subResolve();
                };
              });
            }
          } else {
            const readReq = objectStore.getAll();
            readReq.onsuccess = function () {
              const end = performance.now();

              const result = readReq.result;
              const resultLength = result.length;
              if (resultLength !== datasetSize) {
                console.error(
                  "[idb][read-all][n-transaction] insufficient full traverse",
                  {
                    resultLength,
                    datasetSize,
                  }
                );
              }
              resolve(end - start);
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-all", "n-transaction"],
                })
              );
            };
          }
        })
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;
    removeLog(logId);
    const accumulateSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = accumulateSum / readAllCount;
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-all][one-transaction] read all");
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readAllCount; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          const readReq = objectStore.getAll();
          readReq.onsuccess = function () {
            const result = readReq.result;
            const resultLength = result.length;
            if (resultLength !== datasetSize) {
              console.error(
                "[idb][read-all][one-transaction] insufficient full traverse",
                {
                  resultLength,
                  datasetSize,
                }
              );
            }
            const end = performance.now();
            resolve(end - start);
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "read-all", "one-transaction"],
              })
            );
          };
        })
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;
	
    const accumulateSum = results.reduce((res, current) => res + current, 0);
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
