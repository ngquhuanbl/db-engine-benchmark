import { TABLE_NAME } from "../../../constants/schema";
import { Action } from "../../../types/action";
import { ReadByRangeResult } from "../../../types/result";
import { calculateRange } from "../../calculate-range";
import { checkChecksum } from "../../check-checksum";
import { patchDOMException } from "../../patch-error";
import { openIndexdDBDatabase } from "../common";

export const execute: Action<ReadByRangeResult> = async (
  data,
  addLog,
  removeLog
) => {
  const dbInstance = await openIndexdDBDatabase();

  const [startRange, middleRange, endRange] = calculateRange(data.length);

  let nTransactionStartRange = -1;
  let nTransactionMiddleRange = -1;
  let nTransactionEndRange = -1;
  let oneTransactionStartRange = -1;
  let oneTransactionMiddleRange = -1;
  let oneTransactionEndRange = -1;

  let startRangeChecksum = 0;
  let middleRangeChecksum = 0;
  let endRangeChecksum = 0;

  //#region n transaction
  {
    const logId = addLog("[idb][read-by-range][n-transaction] start range");
    const { from, to } = startRange;
    let start = performance.now();
    startRangeChecksum = await new Promise<number>((resolve, reject) => {
      const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
      const objectStore = transaction.objectStore(TABLE_NAME);
      const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
      readReq.onsuccess = function () {
        const result = readReq.result;
        resolve(result?.length);
      };
      readReq.onerror = function () {
        reject(
          patchDOMException(readReq.error!, {
            tags: ["idb", "read-by-range", "n-transaction", "start range"],
          })
        );
      };
    });
    let end = performance.now();
    removeLog(logId);
    nTransactionStartRange = end - start;
  }

  {
    const logId = addLog("[idb][read-by-range][n-transaction] middle range");
    const { from, to } = middleRange;
    let start = performance.now();
    middleRangeChecksum = await new Promise<number>((resolve, reject) => {
      const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
      const objectStore = transaction.objectStore(TABLE_NAME);
      const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
      readReq.onsuccess = function () {
        const result = readReq.result;
        resolve(result?.length);
      };
      readReq.onerror = function () {
        reject(
          patchDOMException(readReq.error!, {
            tags: ["idb", "read-by-range", "n-transaction", "middle range"],
          })
        );
      };
    });
    let end = performance.now();
    removeLog(logId);
    nTransactionMiddleRange = end - start;
  }

  {
    const logId = addLog("[idb][read-by-range][n-transaction] end range");
    const { from, to } = endRange;
    let start = performance.now();
    endRangeChecksum = await new Promise<number>((resolve, reject) => {
      const transaction = dbInstance.transaction(TABLE_NAME, "readonly");
      const objectStore = transaction.objectStore(TABLE_NAME);
      const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
      readReq.onsuccess = function () {
        const result = readReq.result;
        resolve(result?.length);
      };
      readReq.onerror = function () {
        reject(
          patchDOMException(readReq.error!, {
            tags: ["idb", "read-by-range", "n-transaction", "end range"],
          })
        );
      };
    });
    let end = performance.now();
    removeLog(logId);
    nTransactionEndRange = end - start;
  }
  //#endregion

  // Check checksum
  if (
    !checkChecksum(
      [startRangeChecksum, middleRangeChecksum, endRangeChecksum],
      data.length
    )
  ) {
    const checksum =
      startRangeChecksum + middleRangeChecksum + endRangeChecksum;
    console.error(`[idb][read-by-range][n-transaction] unmatched checksum`, {
      checksum,
      datasetSize: data.length,
      startRangeChecksum,
      middleRangeChecksum,
      endRangeChecksum,
    });
  }

  // Reset checksum
  startRangeChecksum = 0;
  middleRangeChecksum = 0;
  endRangeChecksum = 0;

  //#region one transaction
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
    const objectStore = transaction.objectStore(TABLE_NAME);
    {
      const logId = addLog("[idb][read-by-range][one-transaction] start range");
      const { from, to } = startRange;
      let start = performance.now();
      startRangeChecksum = await new Promise<number>((resolve, reject) => {
        const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
        readReq.onsuccess = function () {
          const result = readReq.result;
          resolve(result?.length);
        };
        readReq.onerror = function () {
          reject(
            patchDOMException(readReq.error!, {
              tags: ["idb", "read-by-range", "one-transaction", "start range"],
            })
          );
        };
      });
      let end = performance.now();
      removeLog(logId);
      oneTransactionStartRange = end - start;
    }
    {
      const logId = addLog(
        "[idb][read-by-range][one-transaction] middle range"
      );
      const { from, to } = middleRange;
      let start = performance.now();
      middleRangeChecksum = await new Promise<number>((resolve, reject) => {
        const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
        readReq.onsuccess = function () {
          const result = readReq.result;
          resolve(result?.length);
        };
        readReq.onerror = function () {
          reject(
            patchDOMException(readReq.error!, {
              tags: ["idb", "read-by-range", "one-transaction", "middle range"],
            })
          );
        };
      });
      let end = performance.now();
      removeLog(logId);
      oneTransactionMiddleRange = end - start;
    }
    {
      const logId = addLog("[idb][read-by-range][one-transaction] end range");
      const { from, to } = endRange;
      let start = performance.now();
      endRangeChecksum = await new Promise<number>((resolve, reject) => {
        const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
        readReq.onsuccess = function () {
          const result = readReq.result;
          resolve(result?.length);
        };
        readReq.onerror = function () {
          reject(
            patchDOMException(readReq.error!, {
              tags: ["idb", "read-by-range", "one-transaction", "end range"],
            })
          );
        };
      });
      let end = performance.now();
      removeLog(logId);
      oneTransactionEndRange = end - start;
    }
  }
  //#endregion

  // Check checksum
  if (
    !checkChecksum(
      [startRangeChecksum, middleRangeChecksum, endRangeChecksum],
      data.length
    )
  ) {
    const checksum =
      startRangeChecksum + middleRangeChecksum + endRangeChecksum;
    console.error(`[idb][read-by-range][one-transaction] unmatched checksum`, {
      checksum,
      datasetSize: data.length,
      startRangeChecksum,
      middleRangeChecksum,
      endRangeChecksum,
    });
  }

  return {
    nTransactionStartRange,
    nTransactionMiddleRange,
    nTransactionEndRange,
    oneTransactionStartRange,
    oneTransactionMiddleRange,
    oneTransactionEndRange,
  };
};
