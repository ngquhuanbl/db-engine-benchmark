import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from '../../../../constants/dataset';
import { ReadFromEndSourceExtraData } from '../../../../types/shared/action';
import { averageFnResults } from '../../../../types/shared/average-objects';
import { ReadFromEndSourceResult } from '../../../../types/shared/result';
import { getAllPossibleConvIds } from '../../../shared/generate-data';
import { patchDOMException } from '../../../shared/patch-error';
import { verifyReadFromEndSource } from '../../../shared/verify-result';
import { getTableFullname, openIndexedDBDatabase } from '../common';

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();
  const allTableFullnames = allPartitionKeys.map(getTableFullname);

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-from-end-source][n-transaction] read");

    const requestsData: Array<{ fullnames: string[] }> = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname] });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames });
      }
    }

    const checksumData: Array<string[]> = [];

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
                  {
                    durability,
                  }
                );
                const objectStore = transaction.objectStore(fullname);
                const readReq = objectStore.openCursor(undefined, "prev");
                readReq.onsuccess = function () {
                  const cursor = readReq.result;
                  if (cursor) {
                    if (checksumData[countIndex] === undefined)
                      checksumData[countIndex] = [];
                    checksumData[countIndex].push(cursor.value.msgId);
                    cursor.continue();
                  } else {
                    resolve();
                  }
                };
                readReq.onerror = function () {
                  reject(
                    patchDOMException(readReq.error!, {
                      tags: ["idb", "read-from-end-source", "n-transaction"],
                    })
                  );
                };
              })
          )
        )
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / readFromEndSourceCount;

    verifyReadFromEndSource(checksumData, datasetSize, readFromEndSourceCount);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-from-end-source][one-transaction] read");
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

    const requestsData: Array<{ fullnames: string[] }> = [];
    for (let i = 0; i < readFromEndSourceCount; i += 1) {
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname] });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames });
      }
    }

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames }, countIndex) =>
        Promise.all(
          fullnames.map(
            (fullname) =>
              new Promise<void>((resolve, reject) => {
                const objectStore = transaction.objectStore(fullname);
                const readReq = objectStore.openCursor(undefined, "prev");
                readReq.onsuccess = function () {
                  const cursor = readReq.result;
                  if (cursor) {
                    if (checksumData[countIndex] === undefined)
                      checksumData[countIndex] = [];
                    checksumData[countIndex].push(cursor.value.msgId);
                    cursor.continue();
                  } else {
                    resolve();
                  }
                };
                readReq.onerror = function () {
                  reject(
                    patchDOMException(readReq.error!, {
                      tags: ["idb", "read-from-end-source", "one-transaction"],
                    })
                  );
                };
              })
          )
        )
      )
    );
    const end = performance.now();
    oneTransactionSum = end - start;
    oneTransactionAverage = oneTransactionSum / readFromEndSourceCount;

    verifyReadFromEndSource(checksumData, datasetSize, readFromEndSourceCount);

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
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ReadFromEndSourceExtraData
): Promise<ReadFromEndSourceResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    datasetSize,
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
