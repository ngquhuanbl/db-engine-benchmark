import { TABLE_NAME } from "../../../../constants/schema";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { DataLoaderImpl } from "../../data-loader";
import { openIndexdDBDatabase, resetIndexedDBData } from "../common";

export const execute = async (
  datasetSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<SingleReadWriteResult> => {
  const dbInstance = await openIndexdDBDatabase();

  const dataLoader = DataLoaderImpl.getInstance();
  const data = await dataLoader.getDataset(datasetSize);

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
    const requests = data.map((item) => {
      const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
      const objectStore = transaction.objectStore(TABLE_NAME);
      const writeReq = objectStore.add(item);
      return new Promise<void>((resolve, reject) => {
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
      });
    });
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
    const requests = data.map((item) => {
      const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
      const objectStore = transaction.objectStore(TABLE_NAME);
      const readReq = objectStore.get(item.msgId);
      return new Promise<void>((resolve, reject) => {
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
      });
    });
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
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests = data.map((item) => {
      const writeReq = objectStore.add(item);
      return new Promise<void>((resolve, reject) => {
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
      });
    });
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
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
    const objectStore = transaction.objectStore(TABLE_NAME);
    const requests = data.map((item) => {
      const readReq = objectStore.get(item.msgId);
      return new Promise<void>((resolve, reject) => {
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
      });
    });
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
