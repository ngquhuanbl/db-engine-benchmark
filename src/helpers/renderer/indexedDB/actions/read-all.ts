// import memoize from "fast-memoize";
import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadAllResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
// import { lastOfArray } from "../../../shared/last-of-array";
// import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadAll } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  datasetSize: number,
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-all][n-transaction] read all");

    const requestsData: Array<{ fullnames: string[] }> = [];
    for (let i = 0; i < readAllCount; i += 1) {
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
                if (readUsingBatch) {
                  // let lastDoc = undefined;
                  // let done = false;
                  // let result = [];
                  // while (done === false) {
                  //   await new Promise<void>((subResolve) => {
                  //     const range = IDBKeyRange.lowerBound(
                  //       lastDoc ? lastDoc.msgId : "",
                  //       true
                  //     );
                  //     const openCursorReq = objectStore.getAll(
                  //       range,
                  //       readBatchSize
                  //     );
                  //     openCursorReq.onerror = function () {
                  //       reject(openCursorReq.error!);
                  //     };
                  //     openCursorReq.onsuccess = function () {
                  //       const subResult: { msgId: string }[] =
                  //         openCursorReq.result;
                  //       lastDoc = lastOfArray(subResult);
                  //       if (subResult.length === 0) {
                  //         done = true;
                  //         finish();
                  //         resultLength += result.length;
                  //         resultByCount.push(...result.map(({ msgId }) => msgId));
                  //         resolve();
                  //       } else result.concat(subResult);
                  //       subResolve();
                  //     };
                  //   });
                  // }
                } else {
                  const readReq = objectStore.getAll();
                  readReq.onsuccess = function () {
                    if (checksumData[countIndex] === undefined)
                      checksumData[countIndex] = [];
                    checksumData[countIndex].push(...readReq.result);

                    resolve();
                  };
                  readReq.onerror = function () {
                    reject(
                      patchDOMException(readReq.error!, {
                        tags: ["idb", "read-all", "n-transaction"],
                      })
                    );
                  };
                }
              })
          )
        )
      )
    );
    const end = performance.now();
    nTransactionSum = end - start;
    nTransactionAverage = nTransactionSum / readAllCount;

    verifyReadAll(checksumData, datasetSize, readAllCount);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog("[idb][read-all][one-transaction] read all");
    const allTableFullnames = allPartitionKeys.map((partitionKey) =>
      getTableFullname(partitionKey)
    );
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

    const requestsData: Array<{ fullnames: string[] }> = [];
    for (let i = 0; i < readAllCount; i += 1) {
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
                const readReq = objectStore.getAll();
                readReq.onsuccess = function () {
                  if (checksumData[countIndex] === undefined)
                    checksumData[countIndex] = [];
                  checksumData[countIndex].push(...readReq.result);

                  resolve();
                };
                readReq.onerror = function () {
                  reject(
                    patchDOMException(readReq.error!, {
                      tags: ["idb", "read-all", "one-transaction"],
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
    oneTransactionAverage = oneTransactionSum / readAllCount;
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
  extraData?: ReadAllExtraData
): Promise<ReadAllResult> => {
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
