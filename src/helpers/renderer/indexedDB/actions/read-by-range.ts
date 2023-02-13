import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { IDBRange } from "../../../../types/shared/indexedDB";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByRange } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { ranges }: ReadByRangeExtraData = { ranges: [] }
): Promise<ReadByRangeResult> => {
  const numOfRanges = ranges.length;
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";
  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(`[idb][read-by-range][n-transaction] read`);

    const requestsData: Array<{
      fullnames: string[];
      range: IDBRange<string>;
    }> = [];
    for (const range of ranges) {
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname], range });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames, range });
      }
    }

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames, range }, countIndex) =>
        Promise.all(
          fullnames.map(
            (fullname) =>
              new Promise<void>((resolve, reject) => {
                const { from, to } = range;
                const transaction = dbInstance.transaction(
                  fullname,
                  "readonly",
                  {
                    durability,
                  }
                );
                const objectStore = transaction.objectStore(fullname);
                const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
                readReq.onsuccess = () => {
                  if (checksumData[countIndex] === undefined) {
                    checksumData[countIndex] = [];
                  }
                  checksumData.push(
                    ...readReq.result.map(({ msgId }) => msgId)
                  );
                  resolve();
                };
                readReq.onerror = () => {
                  reject(
                    patchDOMException(readReq.error!, {
                      tags: ["idb", "read-by-range", "n-transaction"],
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
    nTransactionAverage = nTransactionSum / numOfRanges;

    verifyReadByRange(checksumData, ranges);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(`[idb][read-by-range][one-transaction] read`);

    const requestsData: Array<{
      fullnames: string[];
      range: IDBRange<string>;
    }> = [];
    for (const range of ranges) {
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname], range });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames, range });
      }
    }

    const checksumData: Array<string[]> = [];

    const allTableFullnames = allPartitionKeys.map(getTableFullname);
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames, range }, countIndex) =>
        Promise.all(
          fullnames.map(
            (fullname) =>
              new Promise<void>((resolve, reject) => {
                const { from, to } = range;
                const objectStore = transaction.objectStore(fullname);
                const readReq = objectStore.getAll(IDBKeyRange.bound(from, to));
                readReq.onsuccess = () => {
                  if (checksumData[countIndex] === undefined) {
                    checksumData[countIndex] = [];
                  }
                  checksumData.push(
                    ...readReq.result.map(({ msgId }) => msgId)
                  );
                  resolve();
                };
                readReq.onerror = () => {
                  reject(
                    patchDOMException(readReq.error!, {
                      tags: ["idb", "read-by-range", "one-transaction"],
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
	oneTransactionAverage = oneTransactionSum / numOfRanges;
	
	verifyReadByRange(checksumData, ranges);
	
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
  extraData?: ReadByRangeExtraData
): Promise<ReadByRangeResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
