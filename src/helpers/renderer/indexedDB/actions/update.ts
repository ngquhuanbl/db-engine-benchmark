import { TABLE_NAME } from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { UpdateResult } from "../../../../types/shared/result";
import {
  getAllPossibleConvIds,
  getData,
  getMsgContentForUpdate,
} from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyUpdateItem } from "../../../shared/verify-result";
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
): Promise<UpdateResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const allPartitionKeys = getAllPossibleConvIds();

  const durability = relaxedDurability ? "relaxed" : "default";

  let partitionKeys: string[] = [];
  if (PARTITION_MODE) {
    partitionKeys = [SELECTED_PARTITION_KEY];
  } else {
    partitionKeys = [...allPartitionKeys];
  }

  const dataset: Array<any> = [];
  for (let i = 0; i < datasetSize; i += 1) {
    const item = getData(i);
    dataset.push(item);
  }

  async function resetData() {
    async function clearData() {
      const logId = addLog("[idb] reset db");
      return resetIndexedDBData(dbInstance).finally(() => removeLog(logId));
    }

    // Reset data
    await clearData();

    // WRITE
    {
      const logId = addLog("[idb][update] verify");
      const allFullnames = partitionKeys.map(getTableFullname);
      const transaction = dbInstance.transaction(allFullnames, "readwrite", {
        durability,
      });

      const requestsData: Array<{ fullname: string; item: any }> = [];
      for (let i = 0; i < datasetSize; i += 1) {
        const item = getData(i);
        const partitionKey = item.toUid;
        if (partitionKeys.includes(partitionKey)) {
          const fullname = getTableFullname(partitionKey);
          requestsData.push({
            item,
            fullname,
          });
        }
      }

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
      );

      removeLog(logId);
    }
  }

  await resetData();

  //#region n transaction
  let nTransaction = -1;

  // UPDATE
  {
    const logId = addLog("[idb][update][n-transaction]");
    const allFullnames = partitionKeys.map(getTableFullname);

    const requestsData: Array<{ fullname: string; item: any }> = [];
    for (let i = 0; i < datasetSize; i += 1) {
      const data = getData(i);
      if (partitionKeys.includes(data.toUid)) {
        const item = {
          ...data,
          content: getMsgContentForUpdate(i),
        };
        const partitionKey = item.toUid;
        const fullname = getTableFullname(partitionKey);
        requestsData.push({ fullname, item });
      }
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ item, fullname }) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(
              allFullnames,
              "readwrite",
              {
                durability,
              }
            );
            const objectStore = transaction.objectStore(fullname);
            const writeReq = objectStore.put(item);
            writeReq.onsuccess = function () {
              resolve();
            };
            writeReq.onerror = function () {
              reject(
                patchDOMException(writeReq.error!, {
                  tags: ["idb", "update", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();
    nTransaction = end - start;

    removeLog(logId);
  }

  // VERIFY
  {
    const allFullnames = partitionKeys.map(getTableFullname);

    const checksumData: Array<{ msgId: string; content: string }> = [];
    const transaction = dbInstance.transaction(allFullnames, "readonly", {
      durability,
    });

    await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<void>((resolve, reject) => {
            const fullname = getTableFullname(partitionKey);
            const objectStore = transaction.objectStore(fullname);
            const readReq = objectStore.getAll();
            readReq.onsuccess = function () {
              const data = readReq.result.map(({ msgId, content }) => ({
                msgId,
                content,
              }));
              checksumData.push(...data);
              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "update", "n-transaction", "read"],
                })
              );
            };
          })
      )
    );

    verifyUpdateItem(checksumData, datasetSize);
  }
  //#endregion

  await resetData();

  //#region one transaction
  let oneTransaction = -1;

  // UPDATE
  {
    const logId = addLog("[idb][update][one-transaction]");
    const allFullnames = partitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });

    const groupByConvId: Record<string, any[]> = {};
    for (let i = 0; i < datasetSize; i += 1) {
      const data = getData(i);
      const partitionKey = data.toUid;
      if (partitionKeys.includes(partitionKey)) {
        if (groupByConvId[partitionKey] === undefined) {
          groupByConvId[partitionKey] = [];
        }
        const item = {
          ...data,
          content: getMsgContentForUpdate(i),
        };
        groupByConvId[partitionKey].push(item);
      }
    }

    const requestsData: Array<[string, any[]]> = Object.entries(groupByConvId);

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ([partitionKey, items]) =>
          new Promise<void>((resolve, reject) => {
            const fullname = getTableFullname(partitionKey);
            const objectStore = transaction.objectStore(fullname);
            Promise.all(
              items.map(
                (item) =>
                  new Promise<void>((itemResolve, itemReject) => {
                    const writeReq = objectStore.put(item);
                    writeReq.onsuccess = function () {
                      itemResolve();
                    };
                    writeReq.onerror = function () {
                      itemReject(
                        patchDOMException(writeReq.error!, {
                          tags: ["idb", "update", "n-transaction"],
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

    oneTransaction = end - start;

    removeLog(logId);
  }
  // VERIFY
  {
    const allFullnames = partitionKeys.map(getTableFullname);

    const checksumData: Array<{ msgId: string; content: string }> = [];
    const transaction = dbInstance.transaction(allFullnames, "readonly", {
      durability,
    });

    await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<void>((resolve, reject) => {
            const fullname = getTableFullname(partitionKey);
            const objectStore = transaction.objectStore(fullname);
            const readReq = objectStore.getAll();
            readReq.onsuccess = function () {
              const data = readReq.result.map(({ msgId, content }) => ({
                msgId,
                content,
              }));
              checksumData.push(...data);
              resolve();
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "update", "n-transaction", "read"],
                })
              );
            };
          })
      )
    );

    verifyUpdateItem(checksumData, datasetSize);
  }

  //#endregion
  return {
    nTransaction,
    oneTransaction,
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
): Promise<UpdateResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog
  );
};
