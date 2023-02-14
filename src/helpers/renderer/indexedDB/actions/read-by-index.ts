import { TABLE_NAME, INDEX_NAME } from "../../../../constants/schema";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByIndexField } from "../../../shared/verify-results";
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
    const logId = addLog(`[idb][read-by-index][n-transaction] read`);

    const checksumData: Array<number> = [];

    const start = performance.now();
    await Promise.all(
      keys.map(
        (key, keyIndex) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(TABLE_NAME);
            const indexObj = objectStore.index(INDEX_NAME);
            const readReq = indexObj.getAll(key);
            readReq.onsuccess = function () {
              const resultLength = readReq.result.length;

              if (checksumData[keyIndex] === undefined)
                checksumData[keyIndex] = 0;
              checksumData[keyIndex] += resultLength;

              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-index", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(`[idb][read-by-index][one-transaction] read`);

    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
    const indexObj = objectStore.index(INDEX_NAME);

    const checksumData: Array<number> = [];

    const start = performance.now();
    await Promise.all(
      keys.map(
        (key, keyIndex) =>
          new Promise<void>((resolve, reject) => {
            const readReq = indexObj.getAll(key);
            readReq.onsuccess = function () {
              const resultLength = readReq.result.length;

              if (checksumData[keyIndex] === undefined)
                checksumData[keyIndex] = 0;
              checksumData[keyIndex] += resultLength;

              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-index", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

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
