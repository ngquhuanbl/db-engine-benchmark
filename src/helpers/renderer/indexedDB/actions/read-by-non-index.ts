import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { Data } from "../../../../types/shared/data";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { getNonIndexConditionForIDB } from "../../../shared/non-index-conditions";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyNonIndexField } from "../../../shared/verify-result";
import { openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const checkFn = getNonIndexConditionForIDB();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(`[idb][read-by-non-index][n-transaction] read`);

    const checksumData: Array<{ status: number; isErrorInfo: boolean }[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: count }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(TABLE_NAME);
            const results: Data[] = [];
            const openCursorReq = objectStore.openCursor();
            openCursorReq.onerror = function () {
              reject(
                patchDOMException(openCursorReq.error!, {
                  tags: ["idb", "read-by-non-index", "n-transaction"],
                })
              );
            };
            openCursorReq.onsuccess = function () {
              const cursor = openCursorReq.result;
              if (cursor) {
                const value = cursor.value;
                if (checkFn(value)) {
                  results.push(value);
                }
                cursor.continue();
              } else {
                if (checksumData[countIndex] === undefined)
                  checksumData[countIndex] = [];
                checksumData[countIndex].push(
                  ...results.map(({ status, isErrorInfo }) => ({
                    isErrorInfo,
                    status,
                  }))
                );

                resolve();
              }
            };
          })
      )
    );
    const end = performance.now();

    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / count;

    verifyNonIndexField(checksumData, count);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(`[idb][read-by-non-index][one-transaction] read`);

    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const checksumData: Array<{ status: number; isErrorInfo: boolean }[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: count }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            const results: Data[] = [];
            const openCursorReq = objectStore.openCursor();
            openCursorReq.onerror = function () {
              reject(
                patchDOMException(openCursorReq.error!, {
                  tags: ["idb", "read-by-non-index", "n-transaction"],
                })
              );
            };
            openCursorReq.onsuccess = function () {
              const cursor = openCursorReq.result;
              if (cursor) {
                const value = cursor.value;
                if (checkFn(value)) {
                  results.push(value);
                }
                cursor.continue();
              } else {
                if (checksumData[countIndex] === undefined)
                  checksumData[countIndex] = [];
                checksumData[countIndex].push(
                  ...results.map(({ status, isErrorInfo }) => ({
                    isErrorInfo,
                    status,
                  }))
                );

                resolve();
              }
            };
          })
      )
    );
    const end = performance.now();

    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / count;

    verifyNonIndexField(checksumData, count);

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
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadByNonIndexExtraData
): Promise<ReadByNonIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
