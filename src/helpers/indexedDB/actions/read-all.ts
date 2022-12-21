import { MIN_READ_ALL_COUNT } from "../../../constants/dataset";
import { TABLE_NAME } from "../../../constants/schema";
import { Action, ReadAllExtraData } from "../../../types/action";
import { ReadAllResult } from "../../../types/result";
import { patchDOMException } from "../../patch-error";
import { openIndexdDBDatabase } from "../common";

export const execute: Action<ReadAllResult, ReadAllExtraData> = async (
  data,
  addLog,
  removeLog,
  { readAllCount } = { readAllCount: MIN_READ_ALL_COUNT }
) => {
  const datasetSize = data.length;

  const dbInstance = await openIndexdDBDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-all][n-transaction] read all");
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readAllCount; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
          const objectStore = transaction.objectStore(TABLE_NAME);
          const start = performance.now();
          const readReq = objectStore.getAll();
          readReq.onsuccess = function () {
            const end = performance.now();

            const result = readReq.result;
            const resultLength = result.length;
            if (resultLength !== datasetSize) {
              console.error("[idb][read-all][n-transaction] wrong result", {
                resultLength,
                datasetSize,
              });
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
        })
      );
    }
    const results = await Promise.all(requests);
    removeLog(logId);
    nTransactionSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = nTransactionSum / readAllCount;
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-all][one-transaction] read all");
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
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
              console.error("[idb][read-all][one-transaction] wrong result", {
                resultLength,
                datasetSize,
              });
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
    const results = await Promise.all(requests);
    removeLog(logId);
    oneTransactionSum = results.reduce((res, current) => res + current, 0);
    oneTransactionAverage = oneTransactionSum / readAllCount;
  }
  //#endregion

  return {
    nTransactionAverage,
	nTransactionSum,
    oneTransactionAverage,
	oneTransactionSum
  };
};
