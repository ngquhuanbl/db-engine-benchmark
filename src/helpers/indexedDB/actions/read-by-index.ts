import { INDEX_NAME, TABLE_NAME } from "../../../constants/schema";
import { Action, ReadByIndexExtraData } from "../../../types/action";
import { ReadByIndexResult } from "../../../types/result";
import { patchDOMException } from "../../patch-error";
import { openIndexdDBDatabase } from "../common";

export const execute: Action<ReadByIndexResult, ReadByIndexExtraData> = async (
  data,
  addLog,
  removeLog,
  { keys } = { keys: [] }
) => {
  const numOfKeys = keys.length;
  const dbInstance = await openIndexdDBDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const requests = keys.map(
      (key, index) =>
        new Promise<number>((resolve, reject) => {
          const logId = addLog(
            `[idb][read-by-index][n-transaction] index ${index}`
          );
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
          const objectStore = transaction.objectStore(TABLE_NAME);
          const indexObj = objectStore.index(INDEX_NAME);
          const start = performance.now();
          const readReq = indexObj.getAll(key);
          readReq.onsuccess = function () {
            const end = performance.now();
            console.log(readReq.result.length);
            resolve(end - start);
            removeLog(logId);
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: [
                  "idb",
                  "read-by-index",
                  "n-transaction",
                  `index ${index}`,
                ],
              })
            );
            removeLog(logId);
          };
        })
    );
    const results = await Promise.all(requests);
    nTransactionSum = results.reduce((result, current) => result + current, 0);
    nTransactionAverage = nTransactionSum / numOfKeys;
  }
  //#endregion

  //#region one transaction
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
    const objectStore = transaction.objectStore(TABLE_NAME);
    const indexObj = objectStore.index(INDEX_NAME);
    const requests = keys.map(
      (key, index) =>
        new Promise<number>((resolve, reject) => {
          const logId = addLog(
            `[idb][read-by-index][one-transaction] index ${index}`
          );
          const start = performance.now();
          const readReq = indexObj.getAll(key);
          readReq.onsuccess = function () {
            const end = performance.now();
            console.log(readReq.result.length);
            resolve(end - start);
            removeLog(logId);
          };
          readReq.onerror = function () {
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
            removeLog(logId);
          };
        })
    );
    const results = await Promise.all(requests);
    oneTransactionSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = oneTransactionSum / numOfKeys;
  }
  //#endregion

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};
