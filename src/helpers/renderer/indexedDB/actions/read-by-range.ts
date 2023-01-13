import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { openIndexedDBDatabase } from "../common";

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

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const requests = ranges.map(
      ({ from, to }, index) =>
        new Promise<number>((resolve, reject) => {
          const logId = addLog(
            `[idb][read-by-range][n-transaction] range ${index}`
          );
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
            durability,
          });
          const objectStore = transaction.objectStore(TABLE_NAME);
          const start = performance.now();
          const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
          readReq.onsuccess = function () {
            const result = readReq.result;
            const resultLength = result.length;
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
            const end = performance.now();
            resolve(end - start);
            removeLog(logId);
          };
          readReq.onerror = function () {
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
        })
    );
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / numOfRanges;
  }
  //#endregion

  //#region one transaction
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests = ranges.map(
      ({ from, to }, index) =>
        new Promise<number>((resolve, reject) => {
          const logId = addLog(
            `[idb][read-by-range][one-transaction] range ${index}`
          );
          const start = performance.now();
          const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
          readReq.onsuccess = function () {
            const result = readReq.result;
            const resultLength = result.length;
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
            resolve(end - start);
            removeLog(logId);
          };
          readReq.onerror = function () {
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
        })
    );
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = results.reduce(
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
