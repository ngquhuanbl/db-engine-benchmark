import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByRange } from "../../../shared/verify-results";
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
    const logId = addLog(`[idb][read-by-range][n-transaction] read`);

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      ranges.map(
        ({ from, to }, rangeIndex) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(TABLE_NAME);
            const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
            readReq.onsuccess = function () {
              const result = readReq.result;

              if (checksumData[rangeIndex] === undefined)
                checksumData[rangeIndex] = [];
              checksumData[rangeIndex].push(
                ...result.map(({ msgId }) => msgId)
              );

              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-range", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    nTransactionSum = end - start;
	nTransactionAverage = nTransactionSum / numOfRanges

    verifyReadByRange(checksumData, ranges);
	
	removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
	const logId = addLog(`[idb][read-by-range][one-transaction] read`);
	
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
	
    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      ranges.map(
        ({ from, to }, rangeIndex) =>
          new Promise<void>((resolve, reject) => {
            const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
            readReq.onsuccess = function () {
              const result = readReq.result;

              if (checksumData[rangeIndex] === undefined)
                checksumData[rangeIndex] = [];
              checksumData[rangeIndex].push(
                ...result.map(({ msgId }) => msgId)
              );

              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-range", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();
	
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / numOfRanges;
	
	verifyReadByRange(checksumData, ranges);
	
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
