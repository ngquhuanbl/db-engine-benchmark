import memoize from "fast-memoize";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import {
  getAllPossibleConvIds,
  getConvId,
  getData,
} from "../../../shared/generate-data";
// import { DataLoaderImpl } from "../../../shared/data-loader";
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
    const durations: number[] = [];
    const requests: Promise<void>[] = [];

    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = getConvId(i);
      const fullname = getTableFullname(partitionKey);
      const transaction = dbInstance.transaction(fullname, "readwrite", {
        durability,
      });
      const objectStore = transaction.objectStore(fullname);
      requests.push(
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const writeReq = objectStore.add(item);
          writeReq.onsuccess = function () {
            finish();
            resolve();
          };
          writeReq.onerror = function () {
            finish();
            reject(
              patchDOMException(writeReq.error!, {
                tags: ["idb", "single-read-write", "n-transaction", "write"],
              })
            );
          };
        })
      );
    }
    await Promise.all(requests).finally(() => {
      removeLog(logId);
    });
    nTransactionWrite = durations.reduce(
      (result, current) => current + result,
      0
    );
  }

  // READ
  {
    const logId = addLog("[idb][single-read-write][n-transaction] read");
    const durations: number[] = [];
    const requests: Promise<void>[] = [];
    const result: string[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      const fullname = getTableFullname(partitionKey);
      const transaction = dbInstance.transaction(fullname, "readwrite", {
        durability,
      });
      const objectStore = transaction.objectStore(fullname);
      requests.push(
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const readReq = objectStore.get(item.msgId);
          readReq.onsuccess = function () {
            finish();
            const entry = readReq.result;
            result.push(entry.msgId);
            resolve();
          };
          readReq.onerror = function () {
            finish();
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "single-read-write", "n-transaction", "read"],
              })
            );
          };
        })
      );
    }
    await Promise.all(requests).finally(() => {
      removeLog(logId);
      verifyReadSingleItem(result, datasetSize);
    });
    nTransactionRead = durations.reduce(
      (result, current) => current + result,
      0
    );
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
    const getObjectStore = memoize((partitionKey: string) => {
      const storeName = getTableFullname(partitionKey);
      return transaction.objectStore(storeName);
    });
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      const objectStore = getObjectStore(partitionKey);
      requests.push(
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const writeReq = objectStore.add(item);
          writeReq.onsuccess = function () {
            finish();
            resolve();
          };
          writeReq.onerror = function () {
            finish();
            reject(
              patchDOMException(writeReq.error!, {
                tags: ["idb", "single-read-write", "n-transaction", "write"],
              })
            );
          };
        })
      );
    }
    await Promise.all(requests).finally(() => {
      removeLog(logId);
    });
    oneTransactionWrite = durations.reduce(
      (result, current) => result + current,
      0
    );
  }
  // READ
  {
    const logId = addLog("[idb][single-read-write][one-transaction] read");
    const allPartitionKeys = getAllPossibleConvIds();
    const allFullnames = allPartitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });
    const getObjectStore = memoize((partitionKey: string) => {
      const storeName = getTableFullname(partitionKey);
      return transaction.objectStore(storeName);
    });
    const requests: Promise<void>[] = [];
    const durations: number[] = [];
	const result: string[] = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      const objectStore = getObjectStore(partitionKey);
      requests.push(
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const finish = () => {
            const end = performance.now();
            durations.push(end - start);
          };
          const readReq = objectStore.get(item.msgId);
          readReq.onsuccess = function () {
            finish();
			const entry = readReq.result;
			result.push(entry.msgId);
            resolve();
          };
          readReq.onerror = function () {
            finish();
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "single-read-write", "n-transaction", "read"],
              })
            );
          };
        })
      );
    }
    await Promise.all(requests).finally(() => {
      removeLog(logId);
	  verifyReadSingleItem(result, datasetSize)
    });
    oneTransactionRead = durations.reduce(
      (result, current) => result + current,
      0
    );
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
