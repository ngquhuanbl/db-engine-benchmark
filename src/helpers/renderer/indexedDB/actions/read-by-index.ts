import { TABLE_NAME, INDEX_NAME } from "../../../../constants/schema";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

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
          const transaction = dbInstance.transaction(TABLE_NAME, "readonly", { durability });
          const objectStore = transaction.objectStore(TABLE_NAME);
          const indexObj = objectStore.index(INDEX_NAME);
          const start = performance.now();
          const readReq = indexObj.getAll(key);
          readReq.onsuccess = function () {
            const end = performance.now();
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
	const start = performance.now();
    const results = await Promise.all(requests);
	const end = performance.now();
	nTransactionSum = end - start;
	
    const accumulateSum = results.reduce((result, current) => result + current, 0);
    nTransactionAverage = accumulateSum / numOfKeys;
  }
  //#endregion

  //#region one transaction
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", { durability });
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
	const start = performance.now();
    const results = await Promise.all(requests);
	const end = performance.now();
	oneTransactionSum = end - start;
	
    const accumulateSum = results.reduce(
      (result, current) => result + current,
      0
    );
    oneTransactionAverage = accumulateSum / numOfKeys;
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
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
