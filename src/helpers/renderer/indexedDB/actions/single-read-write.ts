import { averageFnResults } from "../../../../types/shared/average-objects";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds, getData } from "../../../shared/generate-data";
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

  const allPartitionKeys = getAllPossibleConvIds();

  const durability = relaxedDurability ? "relaxed" : "default";

  let partitionKeys: string[] = [];
  if (PARTITION_MODE) {
    partitionKeys = [SELECTED_PARTITION_KEY];
  } else {
    partitionKeys = [...allPartitionKeys];
  }

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
      const partitionKey = item.toUid;
      if (partitionKeys.includes(partitionKey)) {
        const fullname = getTableFullname(partitionKey);
        requestsData.push({ fullname, item });
      }
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
      if (partitionKeys.includes(partitionKey)) {
        const fullname = getTableFullname(partitionKey);
        requestsData.push({ fullname, item });
      }
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
    const allFullnames = partitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });

    const groupByConvId: Record<string, any[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      if (partitionKeys.includes(partitionKey)) {
        const fullname = getTableFullname(partitionKey);

        if (groupByConvId[fullname] === undefined) {
          groupByConvId[fullname] = [];
        }

        groupByConvId[fullname].push(item);
      }
    }

    const requestsData: Array<[string, any]> = Object.entries(groupByConvId);

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ([fullname, items]) =>
          new Promise<void>((resolve, reject) => {
            const objectStore = transaction.objectStore(fullname);
            Promise.all(
              items.map(
                (item) =>
                  new Promise<void>((itemResolve, itemReject) => {
                    const writeReq = objectStore.add(item);
                    writeReq.onsuccess = function () {
                      itemResolve();
                    };
                    writeReq.onerror = function () {
                      itemReject(
                        patchDOMException(writeReq.error!, {
                          tags: [
                            "idb",
                            "single-read-write",
                            "n-transaction",
                            "write",
                          ],
                        })
                      );
                    };
                  })
              )
            )
              .then(() => resolve())
              .catch(reject);
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
    const allFullnames = partitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });

    const groupByConvId: Record<string, string[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const item = getData(i);
      const partitionKey = item.toUid;
      if (partitionKeys.includes(partitionKey)) {
        const fullname = getTableFullname(partitionKey);

        if (groupByConvId[fullname] === undefined) groupByConvId[fullname] = [];

        groupByConvId[fullname].push(item.msgId);
      }
    }

    const requestsData: Array<[string, string[]]> =
      Object.entries(groupByConvId);

    const checksumData: string[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ([fullname, msgIds]) =>
          new Promise<void>((resolve, reject) => {
            const objectStore = transaction.objectStore(fullname);
            Promise.all(
              msgIds.map(
                (msgId) =>
                  new Promise<void>((itemResolve, itemReject) => {
                    const readReq = objectStore.get(msgId);
                    readReq.onsuccess = function () {
                      const entry = readReq.result;
                      checksumData.push(entry.msgId);
                      itemResolve();
                    };
                    readReq.onerror = function () {
                      itemReject(
                        patchDOMException(readReq.error!, {
                          tags: [
                            "idb",
                            "single-read-write",
                            "n-transaction",
                            "read",
                          ],
                        })
                      );
                    };
                  })
              )
            )
              .then(() => resolve())
              .catch(reject);
          })
      )
    );
    const end = performance.now();
    oneTransactionRead = end - start;
	
    removeLog(logId);
	
    verifyReadSingleItem(checksumData, datasetSize);
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
