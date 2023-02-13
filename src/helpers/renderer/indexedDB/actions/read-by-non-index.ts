import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { getNonIndexConditionForIDB } from "../../../shared/non-index-conditions";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyNonIndexField } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";
  const allPartitionKeys = getAllPossibleConvIds();

  const checkFn = getNonIndexConditionForIDB();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(`[idb][read-by-non-index][n-transaction] read`);

    const requestsData: Array<{ fullnames: string[] }> = [];
    for (let i = 0; i < count; i += 1) {
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname] });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames });
      }
    }

    const checksumData: Array<{ isErrorInfo: boolean; status: number }[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames }, countIndex) =>
        Promise.all(
          fullnames.map(
            (fullname) =>
              new Promise<void>((resolve, reject) => {
                const transaction = dbInstance.transaction(
                  fullname,
                  "readonly",
                  { durability }
                );
                const objectStore = transaction.objectStore(fullname);
                const openCursorReq = objectStore.openCursor();
                openCursorReq.onsuccess = () => {
                  const cursor = openCursorReq.result;
                  if (cursor) {
                    const value = cursor.value;
                    if (checkFn(value)) {
                      if (checksumData[countIndex] === undefined)
                        checksumData[countIndex] = [];
                      const { isErrorInfo, status } = value;
                      checksumData[countIndex].push({ isErrorInfo, status });
                    }
                    cursor.continue();
                  } else resolve();
                };
                openCursorReq.onerror = () => {
                  reject(openCursorReq.error);
                };
              })
          )
        )
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;

    nTransactionAverage = nTransactionSum / count;

    verifyNonIndexField(checksumData, +count);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(`[idb][read-by-non-index][one-transaction] read`);

    const requestsData: Array<{ fullnames: string[] }> = [];
    for (let i = 0; i < count; i += 1) {
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname] });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames });
      }
    }

    const checksumData: Array<{ isErrorInfo: boolean; status: number }[]> = [];

    const allTableFullnames = allPartitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames }, countIndex) =>
        Promise.all(
          fullnames.map(
            (fullname) =>
              new Promise<void>((resolve, reject) => {
                const objectStore = transaction.objectStore(fullname);
                const openCursorReq = objectStore.openCursor();
                openCursorReq.onerror = function () {
                  reject(
                    patchDOMException(openCursorReq.error!, {
                      tags: ["idb", "read-by-non-index", "one-transaction"],
                    })
                  );
                };
                openCursorReq.onsuccess = function () {
                  const cursor = openCursorReq.result;
                  if (cursor) {
                    const value = cursor.value;
                    if (checkFn(value)) {
                      if (checksumData[countIndex] === undefined)
                        checksumData[countIndex] = [];
                      const { isErrorInfo, status } = value;
                      checksumData[countIndex].push({ isErrorInfo, status });
                    }
                    cursor.continue();
                  } else {
                    resolve();
                  }
                };
              })
          )
        )
      )
    );
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / count;

    verifyNonIndexField(checksumData, +count);

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
  extraData?: ReadByNonIndexExtraData
): Promise<ReadByNonIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
