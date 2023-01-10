import { TABLE_NAME } from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import { getData } from "../../../shared/generate-data";
// import { DataLoaderImpl } from "../../../shared/data-loader";
import { patchDOMException } from "../../../shared/patch-error";
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

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;
  // WRITE
  {
    const logId = addLog("[idb][single-read-write][n-transaction] write");
    const requests: Promise<void>[] = [];

    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
        durability,
      });
      const objectStore = transaction.objectStore(TABLE_NAME);
      const writeReq = objectStore.add(item);
      requests.push(
        new Promise<void>((resolve, reject) => {
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
      );
    }
    const start = performance.now();
    let end = -1;
    await Promise.all(requests).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    nTransactionWrite = end - start;
  }

  // READ
  {
    const logId = addLog("[idb][single-read-write][n-transaction] read");
    const requests: Promise<void>[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
        durability,
      });
      const objectStore = transaction.objectStore(TABLE_NAME);
      const readReq = objectStore.get(item.msgId);
      requests.push(
        new Promise<void>((resolve, reject) => {
          readReq.onsuccess = function () {
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
      );
    }
    const start = performance.now();
    let end = -1;
    await Promise.all(requests).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    nTransactionRead = end - start;
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
    const requests: Promise<void>[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const writeReq = objectStore.add(item);
      requests.push(
        new Promise<void>((resolve, reject) => {
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
      );
    }
    const start = performance.now();
    let end = -1;
    await Promise.all(requests).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    oneTransactionWrite = end - start;
  }
  // READ
  {
    const logId = addLog("[idb][single-read-write][one-transaction] read");
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests: Promise<void>[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const readReq = objectStore.get(item.msgId);
      requests.push(
        new Promise<void>((resolve, reject) => {
          readReq.onsuccess = function () {
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
      );
    }
    const start = performance.now();
    let end = -1;
    await Promise.all(requests).finally(() => {
      end = performance.now();
      removeLog(logId);
    });
    oneTransactionRead = end - start;
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
