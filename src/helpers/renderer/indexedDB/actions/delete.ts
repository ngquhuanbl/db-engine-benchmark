import { averageFnResults } from "../../../../types/shared/average-objects";
import { UpdateResult } from "../../../../types/shared/result";
import {
  getAllPossibleConvIds,
  getData,
  getMsgDeleteInfo,
} from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyDeleteItem } from "../../../shared/verify-result";
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
      const logId = addLog("[idb][delete] verify");
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

  // DELETE
  {
    const logId = addLog("[idb][delete][n-transaction]");
    const allFullnames = partitionKeys.map(getTableFullname);

    const requestsData: Array<{ fullname: string; msgId: string }> = [];

    const msgInfoToDelete = getMsgDeleteInfo(datasetSize);

    for (const { msgId, toUid } of msgInfoToDelete) {
      const partitionKey = toUid;
      if (partitionKeys.includes(partitionKey)) {
        const fullname = getTableFullname(partitionKey);
        requestsData.push({ fullname, msgId });
      }
    }

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ({ msgId, fullname }) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(
              allFullnames,
              "readwrite",
              {
                durability,
              }
            );
            const objectStore = transaction.objectStore(fullname);
            const writeReq = objectStore.delete(msgId);
            writeReq.onsuccess = function () {
              resolve();
            };
            writeReq.onerror = function () {
              reject(
                patchDOMException(writeReq.error!, {
                  tags: ["idb", "delete", "n-transaction"],
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

    const transaction = dbInstance.transaction(allFullnames, "readonly", {
      durability,
    });

    const resultLength = await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<number>((resolve, reject) => {
            const fullname = getTableFullname(partitionKey);
            const objectStore = transaction.objectStore(fullname);
            const countReq = objectStore.count();
            countReq.onsuccess = function () {
              resolve(countReq.result);
            };
            countReq.onerror = function () {
              reject(
                patchDOMException(countReq.error!, {
                  tags: ["idb", "delete", "n-transaction", "read"],
                })
              );
            };
          })
      )
    ).then((counts) => counts.reduce((result, current) => result + current, 0));

    verifyDeleteItem(resultLength);
  }
  //#endregion

  await resetData();

  //#region one transaction
  let oneTransaction = -1;

  // DELETE
  {
    const logId = addLog("[idb][delete][one-transaction]");
    const allFullnames = partitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allFullnames, "readwrite", {
      durability,
    });

    const msgInfoToDelete = getMsgDeleteInfo(datasetSize);

    const groupByConvId: Record<string, string[]> = {};
    for (const { msgId, toUid } of msgInfoToDelete) {
      const partitionKey = toUid;
      if (partitionKeys.includes(partitionKey)) {
        if (groupByConvId[partitionKey] === undefined) {
          groupByConvId[partitionKey] = [];
        }
        groupByConvId[partitionKey].push(msgId);
      }
    }

    const requestsData: Array<[string, string[]]> =
      Object.entries(groupByConvId);

    const start = performance.now();
    await Promise.all(
      requestsData.map(
        ([partitionKey, msgIds]) =>
          new Promise<void>((resolve, reject) => {
            const fullname = getTableFullname(partitionKey);
            const objectStore = transaction.objectStore(fullname);
            Promise.all(
              msgIds.map(
                (msgId) =>
                  new Promise<void>((itemResolve, itemReject) => {
                    const writeReq = objectStore.delete(msgId);
                    writeReq.onsuccess = function () {
                      itemResolve();
                    };
                    writeReq.onerror = function () {
                      itemReject(
                        patchDOMException(writeReq.error!, {
                          tags: ["idb", "delete", "n-transaction"],
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

    const transaction = dbInstance.transaction(allFullnames, "readonly", {
      durability,
    });

    const resultLength = await Promise.all(
      partitionKeys.map(
        (partitionKey) =>
          new Promise<number>((resolve, reject) => {
            const fullname = getTableFullname(partitionKey);
            const objectStore = transaction.objectStore(fullname);
            const countReq = objectStore.count();
            countReq.onsuccess = function () {
              resolve(countReq.result);
            };
            countReq.onerror = function () {
              reject(
                patchDOMException(countReq.error!, {
                  tags: ["idb", "delete", "n-transaction", "read"],
                })
              );
            };
          })
      )
    ).then((counts) => counts.reduce((result, current) => result + current, 0));

    verifyDeleteItem(resultLength);
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
