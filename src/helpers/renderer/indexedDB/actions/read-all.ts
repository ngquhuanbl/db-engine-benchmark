import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadAllResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadAll } from "../../../shared/verify-results";
import { openIndexedDBDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-all][n-transaction] read all");

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: readAllCount }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(TABLE_NAME);
            const readReq = objectStore.getAll();
            readReq.onsuccess = function () {
              const result = readReq.result;

              if (checksumData[countIndex] === undefined)
                checksumData[countIndex] = [];
              checksumData[countIndex].push(
                ...result.map(({ msgId }) => msgId)
              );

              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-all", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / readAllCount;

    verifyReadAll(checksumData, datasetSize, readAllCount);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-all][one-transaction] read all");
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: readAllCount }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            const readReq = objectStore.getAll();
            readReq.onsuccess = function () {
              const result = readReq.result;

              if (checksumData[countIndex] === undefined)
                checksumData[countIndex] = [];
              checksumData[countIndex].push(
                ...result.map(({ msgId }) => msgId)
              );

              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-all", "one-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / readAllCount;

    verifyReadAll(checksumData, datasetSize, readAllCount);

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
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadAllExtraData
): Promise<ReadAllResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
