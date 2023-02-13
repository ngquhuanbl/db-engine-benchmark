import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import {
  getAllPossibleConvIds,
  getConvId,
  getData,
} from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadSingleItem } from "../../../shared/verify-result";
import {
  getTableFullname,
  openIndexedDBDatabase,
  resetIndexedDBData,
} from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<SingleReadWriteResult> => {
  const dbInstance = await openIndexedDBDatabase();
  
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

    const requestsData: Array<{ fullname: string; item: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = getConvId(i);
      const fullname = getTableFullname(partitionKey);
      requestsData.push({ fullname, item });
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ fullname, item }) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(fullname, "readwrite", {
              durability,
            });
            const objectStore = transaction.objectStore(fullname);
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

    const requestsData: Array<{ fullname: string; item: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      const fullname = getTableFullname(partitionKey);
      requestsData.push({ fullname, item });
    }

    const checksumData: string[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ fullname, item }) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(fullname, "readwrite", {
              durability,
            });
            const objectStore = transaction.objectStore(fullname);

            const readReq = objectStore.get(item.msgId);
            readReq.onsuccess = function () {
              const entry = readReq.result;
              checksumData.push(entry.msgId);
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

    removeLog(logId);
    verifyReadSingleItem(checksumData, datasetSize);
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
    const allPartitionKeys = getAllPossibleConvIds();
    const allFullnames = allPartitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });

    const requestsData: Array<{ fullname: string; item: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      const fullname = getTableFullname(partitionKey);
      requestsData.push({
        item,
        fullname,
      });
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ item, fullname }) =>
          new Promise<void>((resolve, reject) => {
            const objectStore = transaction.objectStore(fullname);
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
    const allPartitionKeys = getAllPossibleConvIds();
    const allFullnames = allPartitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });

    const requestsData: Array<{ fullname: string; key: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      const fullname = getTableFullname(partitionKey);
      requestsData.push({
        fullname,
        key: item.msgId,
      });
    }

    const checksumData: string[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ fullname, key }) =>
          new Promise<void>((resolve, reject) => {
            const objectStore = transaction.objectStore(fullname);
            const readReq = objectStore.get(key);
            readReq.onsuccess = function () {
              const entry = readReq.result;
              checksumData.push(entry.msgId);
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
