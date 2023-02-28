import { TABLE_NAME } from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import { getData } from "../../../shared/generate-data";
// import { DataLoaderImpl } from "../../../shared/data-loader";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadSingleItem } from "../../../shared/verify-result";
import { openIndexedDBDatabase, resetIndexedDBData } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<SingleReadWriteResult> => {
  const dbInstance = await openIndexedDBDatabase();

  //   const dataLoader = DataLoaderImpl.getInstance();
  //   const data = await dataLoader.getDataset(datasetSize);

  const durability = relaxedDurability ? "relaxed" : "default";

  async function resetData() {
    const logId = addLog("[idb] reset db");
    return resetIndexedDBData(dbInstance).finally(() => {
      removeLog(logId);
    });
  }

  const dataset: Array<any> = [];
  for (let i = 0; i < datasetSize; i += 1) {
    const item = getData(i);
    dataset.push(item);
  }

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;
  // WRITE
  {
    const logId = addLog("[idb][single-read-write][n-transaction] write");

    const start = performance.now();
    await Promise.all(
      dataset.map(
        (item) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(
              TABLE_NAME,
              "readwrite",
              {
                durability,
              }
            );
            const objectStore = transaction.objectStore(TABLE_NAME);
            const writeReq = objectStore.add(item);
            writeReq.onsuccess = function () {
              resolve();
            };
            writeReq.onerror = function () {
              reject(
                patchDOMException(writeReq.error!, {
                  tags: ["idb", "single-read-write", "n-transaction", "write"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();
    nTransactionWrite = end - start;

    removeLog(logId);
  }

  // READ
  {
    const logId = addLog("[idb][single-read-write][n-transaction] read");

    const checksumData: Array<string> = [];

    const start = performance.now();
    await Promise.all(
      dataset.map(
        ({ msgId }) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(
              TABLE_NAME,
              "readwrite",
              {
                durability,
              }
            );
            const objectStore = transaction.objectStore(TABLE_NAME);
            const readReq = objectStore.get(msgId);
            readReq.onsuccess = function () {
              const result = readReq.result;
              const { msgId } = result;
              checksumData.push(msgId);
              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "single-read-write", "n-transaction", "read"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();
    nTransactionRead = end - start;

    verifyReadSingleItem(checksumData, datasetSize);

    removeLog(logId);
  }
  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransactionRead = -1;
  let oneTransactionWrite = -1;
  // WRITE
  {
    const logId = addLog("[idb][single-read-write][one-transaction] write");
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const start = performance.now();
    await Promise.all(
      dataset.map(
        (item) =>
          new Promise<void>((resolve, reject) => {
            const writeReq = objectStore.add(item);
            writeReq.onsuccess = function () {
              resolve();
            };
            writeReq.onerror = function () {
              reject(
                patchDOMException(writeReq.error!, {
                  tags: ["idb", "single-read-write", "n-transaction", "write"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    oneTransactionWrite = end - start;

    removeLog(logId);
  }
  // READ
  {
    const logId = addLog("[idb][single-read-write][one-transaction] read");
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const checksumData: Array<string> = [];

    const start = performance.now();
    await Promise.all(
      dataset.map(
        ({ msgId }) =>
          new Promise<void>((resolve, reject) => {
            const readReq = objectStore.get(msgId);
            readReq.onsuccess = function () {
              const { msgId } = readReq.result;
              checksumData.push(msgId);
              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "single-read-write", "n-transaction", "read"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    oneTransactionRead = end - start;

    verifyReadSingleItem(checksumData, datasetSize);

    removeLog(logId);
  }

  //#endregion
  return {
    nTransactionRead,
    nTransactionWrite,
    oneTransactionRead,
    oneTransactionWrite,
  };
};

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<SingleReadWriteResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog
  );
};
