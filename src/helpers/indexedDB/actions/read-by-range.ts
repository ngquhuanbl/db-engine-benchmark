import { TABLE_NAME } from "../../../constants/schema";
import { Action, ReadByRangeExtraData } from "../../../types/action";
import { ReadByRangeResult } from "../../../types/result";
import { patchDOMException } from "../../patch-error";
import { openIndexdDBDatabase } from "../common";

export const execute: Action<ReadByRangeResult, ReadByRangeExtraData> = async (
  data,
  addLog,
  removeLog,
  { ranges } = { ranges: [] }
) => {
  const numOfRanges = ranges.length;
  const dbInstance = await openIndexdDBDatabase();

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
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
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
    const results = await Promise.all(requests);
    nTransactionSum = results.reduce((result, current) => result + current, 0);
    nTransactionAverage = nTransactionSum / numOfRanges;
  }
  //#endregion

  //#region one transaction
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
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
    const results = await Promise.all(requests);
    oneTransactionSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = oneTransactionSum / numOfRanges;
  }
  //#endregion

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};
