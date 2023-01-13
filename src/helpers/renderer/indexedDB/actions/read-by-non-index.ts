import { TABLE_NAME, INDEX_NAME } from "../../../../constants/schema";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { Data } from "../../../../types/shared/data";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { getNonIndexConditionForIDB } from "../../../shared/non-index-conditions";
import { patchDOMException } from "../../../shared/patch-error";
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

  // Checksum
  let resultsLength = -1;

  //#region n transaction
  {
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const logId = addLog(`[idb][read-by-non-index][n-transaction] ${i}`);

          const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
            durability,
          });
          const objectStore = transaction.objectStore(TABLE_NAME);
          const results: Data[] = [];
          const start = performance.now();
          const openCursorReq = objectStore.openCursor();
          openCursorReq.onerror = function () {
            reject(
              patchDOMException(openCursorReq.error!, {
                tags: ["idb", "read-by-non-index", "n-transaction", `${i}`],
              })
            );
            removeLog(logId);
          };
          openCursorReq.onsuccess = function () {
            const cursor = openCursorReq.result;
            if (cursor) {
              const value = cursor.value;
              if (checkFn(value)) results.push(value);
              cursor.continue();
            } else {
              const end = performance.now();
              resolve(end - start);
              if (resultsLength === -1) resultsLength = results.length;
              else if (resultsLength !== results.length) {
                console.error(
                  "[idb][read-by-non-index][n-transaction] inconsistent result length",
                  {
                    expected: resultsLength,
                    actual: results.length,
                  }
                );
              }

              if (results.length === 0) {
                console.error(
                  "[idb][read-by-non-index][n-transaction] empty result"
                );
              }
              removeLog(logId);
            }
          };
        })
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    nTransactionSum = end - start;

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    nTransactionAverage = accumulateSum / count;
  }
  //#endregion

  //#region one transaction
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests: Promise<number>[] = [];
    for (let i = 0; i < count; i += 1) {
      requests.push(
        new Promise<number>((resolve, reject) => {
          const logId = addLog(
            `[idb][read-by-non-index][one-transaction] ${i}`
          );
          const results: Data[] = [];
          const start = performance.now();
          const openCursorReq = objectStore.openCursor();
          openCursorReq.onerror = function () {
            reject(
              patchDOMException(openCursorReq.error!, {
                tags: ["idb", "read-by-non-index", "one-transaction", `${i}`],
              })
            );
            removeLog(logId);
          };
          openCursorReq.onsuccess = function () {
            const cursor = openCursorReq.result;
            if (cursor) {
              const value = cursor.value;
              if (checkFn(value)) results.push(value);
              cursor.continue();
            } else {
              const end = performance.now();
              resolve(end - start);
              if (resultsLength === -1) resultsLength = results.length;
              else if (resultsLength !== results.length) {
                console.error(
                  "[idb][read-by-non-index][one-transaction] inconsistent result length",
                  {
                    expected: resultsLength,
                    actual: results.length,
                  }
                );
              }
              if (results.length === 0) {
                console.error(
                  "[idb][read-by-non-index][one-transaction] empty result"
                );
              }
              removeLog(logId);
            }
          };
        })
      );
    }
    const start = performance.now();
    const results = await Promise.all(requests);
    const end = performance.now();
    oneTransactionSum = end - start;

    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / count;
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
