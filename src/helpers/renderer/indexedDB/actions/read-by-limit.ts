import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { openIndexdDBDatabase } from "../common";

export const execute = async (
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { limit, count }: ReadByLimitExtraData = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
): Promise<ReadByLimitResult> => {
  const dbInstance = await openIndexdDBDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-by-limit][n-transaction] read");
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
          const objectStore = transaction.objectStore(TABLE_NAME);
          const start = performance.now();
          const readReq = objectStore.openCursor();
          const result = [];
          const finish = () => {
            const end = performance.now();
            resolve(end - start);
          };
          readReq.onsuccess = function () {
            const cursor = readReq.result;
            if (cursor) {
              result.push(cursor.value);
              if (result.length === limit) {
                finish();
              } else cursor.continue();
            } else {
              finish();
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
    }
    const results = await Promise.all(requests);
    removeLog(logId);
    nTransactionSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = nTransactionSum / count;
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-by-limit][one-transaction] read");
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          const readReq = objectStore.openCursor();
          const result = [];
          const finish = () => {
            const end = performance.now();
            resolve(end - start);
          };
          readReq.onsuccess = function () {
            const cursor = readReq.result;
            if (cursor) {
              result.push(cursor.value);
              if (result.length === limit) {
                finish();
              } else cursor.continue();
            } else {
              finish();
            }
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "read-by-limit", "one-transaction"],
              })
            );
          };
        })
      );
    }
    const results = await Promise.all(requests);
    removeLog(logId);
    oneTransactionSum = results.reduce((res, current) => res + current, 0);
    oneTransactionAverage = oneTransactionSum / count;
  }
  //#endregion

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};
