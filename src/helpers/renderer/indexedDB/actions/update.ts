import { TABLE_NAME } from "../../../../constants/schema";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { UpdateResult } from "../../../../types/shared/result";
import { getData, getMsgContentForUpdate } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyUpdateItem } from "../../../shared/verify-results";
import { openIndexedDBDatabase, resetIndexedDBData } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
): Promise<UpdateResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const dataset: Array<any> = [];
  for (let i = 0; i < datasetSize; i += 1) {
    const item = getData(i);
    dataset.push(item);
  }

  async function resetData() {
    // Insert data

    async function clearData() {
      const logId = addLog("[idb] reset db");
      return resetIndexedDBData(dbInstance).finally(() => {
        removeLog(logId);
      });
    }

    // Reset data
    await clearData();

    // WRITE
    {
      const logId = addLog(
        "[idb][update][one-transaction] fill data before updating"
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
                    tags: ["idb", "update", "one-transaction"],
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
    const logId = addLog("[idb][update][n-transaction] write");

    const start = performance.now();
    await Promise.all(
      dataset.map(
        (item, itemIndex) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(
              TABLE_NAME,
              "readwrite",
              {
                durability,
              }
            );
            const objectStore = transaction.objectStore(TABLE_NAME);
            const newEntry = {
              ...item,
              content: getMsgContentForUpdate(itemIndex),
            };
            const writeReq = objectStore.put(newEntry);
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
    const checksumData: Array<{ msgId: string; content: string }> = [];
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    await Promise.all(
      dataset.map(
        ({ msgId }) =>
          new Promise<void>((resolve, reject) => {
            const readReq = objectStore.get(msgId);
            readReq.onsuccess = function () {
              const result = readReq.result;
              const { content, msgId } = result;
              checksumData.push({ content, msgId });
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
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const start = performance.now();
    await Promise.all(
      dataset.map(
        (item, itemIndex) =>
          new Promise<void>((resolve, reject) => {
            const newEntry = {
              ...item,
              content: getMsgContentForUpdate(itemIndex),
            };
            const writeReq = objectStore.put(newEntry);
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

    oneTransaction = end - start;

    removeLog(logId);
  }
  // VERIFY
  {
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);

    const checksumData: Array<{ msgId: string; content: string }> = [];

    await Promise.all(
      dataset.map(
        ({ msgId }) =>
          new Promise<void>((resolve, reject) => {
            const readReq = objectStore.get(msgId);
            readReq.onsuccess = function () {
              const { msgId, content } = readReq.result;
              checksumData.push({ msgId, content });
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
