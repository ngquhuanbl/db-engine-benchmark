import { MIN_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../constants/dataset";
import { TABLE_NAME } from "../../../constants/schema";
import {
  Action,
  ReadFromTheEndOfSourceDataExtraData,
} from "../../../types/action";
import { ReadFromTheEndOfSourceDataResult } from "../../../types/result";
import { patchDOMException } from "../../patch-error";
import { openIndexdDBDatabase } from "../common";

export const execute: Action<
ReadFromTheEndOfSourceDataResult,
  ReadFromTheEndOfSourceDataExtraData
> = async (
  data,
  addLog,
  removeLog,
  { readFromTheEndOfSourceDataCount } = {
    readFromTheEndOfSourceDataCount: MIN_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
) => {
  const datasetSize = data.length;

  const dbInstance = await openIndexdDBDatabase();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-from-end-source][n-transaction] read");
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readFromTheEndOfSourceDataCount; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
          const objectStore = transaction.objectStore(TABLE_NAME);
          const start = performance.now();
          const readReq = objectStore.openCursor(undefined, "prev");
		  const result = [];
          readReq.onsuccess = function () {
			const cursor = readReq.result;
			if (cursor) {
				result.push(cursor.value);
				cursor.continue();
			} else {
				const end = performance.now();
	
				const resultLength = result.length;
				if (resultLength !== datasetSize) {
				  console.error("[idb][read-from-end-source][n-transaction] wrong result", {
					resultLength,
					datasetSize,
				  });
				}
				resolve(end - start);
			}
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "read-from-end-source", "n-transaction"],
              })
            );
          };
        })
      );
    }
    const results = await Promise.all(requests);
    removeLog(logId);
    nTransactionSum = results.reduce((res, current) => res + current, 0);
    nTransactionAverage = nTransactionSum / readFromTheEndOfSourceDataCount;
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-from-end-source][one-transaction] read");
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests: Promise<number>[] = [];
    for (let i = 0; i < readFromTheEndOfSourceDataCount; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const start = performance.now();
          const readReq = objectStore.openCursor(undefined, 'prev');
		  const result = [];
          readReq.onsuccess = function () {
			const cursor = readReq.result;
			if (cursor) {
				result.push(cursor.value);
				cursor.continue();
			} else {
				const resultLength = result.length;
				if (resultLength !== datasetSize) {
				  console.error("[idb][read-from-end-source][one-transaction] wrong result", {
					resultLength,
					datasetSize,
				  });
				}
				const end = performance.now();
				resolve(end - start);
			}
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "read-from-end-source", "one-transaction"],
              })
            );
          };
        })
      );
    }
    const results = await Promise.all(requests);
    removeLog(logId);
    oneTransactionSum = results.reduce((res, current) => res + current, 0);
    oneTransactionAverage = oneTransactionSum / readFromTheEndOfSourceDataCount;
  }
  //#endregion

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};
