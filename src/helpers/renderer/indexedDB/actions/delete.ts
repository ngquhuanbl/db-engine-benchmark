import { TABLE_NAME } from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { DeleteResult } from "../../../../types/shared/result";
import { getData, getMsgDeleteMsgId } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyDeleteItem } from "../../../shared/verify-results";
import { openIndexedDBDatabase, resetIndexedDBData } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<DeleteResult> => {
  const dbInstance = await openIndexedDBDatabase();

  //   const dataLoader = DataLoaderImpl.getInstance();
  //   const data = await dataLoader.getDataset(datasetSize);

  const durability = relaxedDurability ? "relaxed" : "default";

  async function resetData() {
    // Insert data

    const durability = relaxedDurability ? "relaxed" : "default";

    async function clearData() {
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
    await clearData();

    // WRITE
    {
      const logId = addLog(
        "[idb][delete][one-transaction] fill data before updating"
      );
      const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
        durability,
      });
      const objectStore = transaction.objectStore(TABLE_NAME);

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
                    tags: ["idb", "delete", "one-transaction"],
                  })
                );
              };
            })
        )
      );
      removeLog(logId);
    }
  }

  //#region n transaction
  let nTransaction = -1;
  
  await resetData();

  // DELETE
  {
    const logId = addLog("[idb][delete][n-transaction]");

    const msgIdsToDelete = getMsgDeleteMsgId(datasetSize);

    const start = performance.now();
    await Promise.all(
      msgIdsToDelete.map(
        (msgId) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(
              TABLE_NAME,
              "readwrite",
              {
                durability,
              }
            );
            const objectStore = transaction.objectStore(TABLE_NAME);
            const deleteReq = objectStore.delete(msgId);
            deleteReq.onsuccess = function () {
              resolve();
            };
            deleteReq.onerror = function () {
              reject(
                patchDOMException(deleteReq.error!, {
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
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const resultLength = await new Promise<number>((resolve, reject) => {
      const countReq = objectStore.count();
      countReq.onsuccess = function () {
        resolve(countReq.result);
      };

      countReq.onerror = function () {
        reject(
          patchDOMException(countReq.error!, {
            tags: ["idb", "count", "n-transaction"],
          })
        );
      };
    });

    verifyDeleteItem(resultLength);
  }
  //#endregion

  await resetData();

  //#region one transaction
  let oneTransaction = -1;

  // DELETE
  {
    const logId = addLog("[idb][delete][one-transaction]");
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const msgIdsToDelete = getMsgDeleteMsgId(datasetSize);

    const start = performance.now();
    await Promise.all(
      msgIdsToDelete.map(
        (msgId) =>
          new Promise<void>((resolve, reject) => {
            const deleteReq = objectStore.delete(msgId);
            deleteReq.onsuccess = function () {
              resolve();
            };
            deleteReq.onerror = function () {
              reject(
                patchDOMException(deleteReq.error!, {
                  tags: ["idb", "delete", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    oneTransaction = end - start;

    removeLog(logId);
  }
  // VERIFY
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const resultLength = await new Promise<number>((resolve, reject) => {
      const countReq = objectStore.count();
      countReq.onsuccess = function () {
        resolve(countReq.result);
      };

      countReq.onerror = function () {
        reject(
          patchDOMException(countReq.error!, {
            tags: ["idb", "count", "one-transaction"],
          })
        );
      };
    });

    verifyDeleteItem(resultLength);
  }
  //#endregion

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
): Promise<DeleteResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog
  );
};
