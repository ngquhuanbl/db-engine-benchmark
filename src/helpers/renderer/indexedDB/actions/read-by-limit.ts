import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { TABLE_NAME } from "../../../../constants/schema";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByLimit } from "../../../shared/verify-result";
import { openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { limit, count }: ReadByLimitExtraData = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
): Promise<ReadByLimitResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-by-limit][n-transaction] read");

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: count }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
              durability,
            });
            const objectStore = transaction.objectStore(TABLE_NAME);
            const readReq = objectStore.openCursor();
            const result = [];
            const finish = () => {
              if (checksumData[countIndex] === undefined)
                checksumData[countIndex] = [];
              checksumData[countIndex].push(
                ...result.map(({ msgId }) => msgId)
              );
              resolve();
            };
            readReq.onsuccess = function () {
              const cursor = readReq.result;
              if (cursor) {
                result.push(cursor.value);
                if (result.length === limit) {
                  finish();
                } else cursor.continue();
              } else {
                finish();
              }
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-limit", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / count;

    verifyReadByLimit(checksumData, count, limit);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-by-limit][one-transaction] read");
    const transaction = dbInstance.transaction(TABLE_NAME, "readonly", {
      durability,
    });
    const objectStore = transaction.objectStore(TABLE_NAME);
    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      Array.from({ length: count }).map(
        (_, countIndex) =>
          new Promise<void>((resolve, reject) => {
            const readReq = objectStore.openCursor();
            const result = [];
            const finish = () => {
              if (checksumData[countIndex] === undefined)
                checksumData[countIndex] = [];
              checksumData[countIndex].push(
                ...result.map(({ msgId }) => msgId)
              );
              resolve();
            };
            readReq.onsuccess = function () {
              const cursor = readReq.result;
              if (cursor) {
                result.push(cursor.value);
                if (result.length === limit) {
                  finish();
                } else cursor.continue();
              } else {
                finish();
              }
            };
            readReq.onerror = function () {
              reject(
                patchDOMException(readReq.error!, {
                  tags: ["idb", "read-by-limit", "n-transaction"],
                })
              );
            };
          })
      )
    );
    const end = performance.now();

    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / count;

    verifyReadByLimit(checksumData, count, limit);

    removeLog(logId);
  }
  //#endregion

  return {
    nTransactionAverage,
    nTransactionSum,
    oneTransactionAverage,
    oneTransactionSum,
  };
};

export const execute = async (
  benchmarkCount: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadByLimitExtraData
): Promise<ReadByLimitResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
