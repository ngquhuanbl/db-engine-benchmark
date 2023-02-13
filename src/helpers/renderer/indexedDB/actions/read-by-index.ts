import { INDEX_NAME } from "../../../../constants/schema";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByIndexField } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

const originalExecute = async (
  relaxedDurability: boolean,
  readUsingBatch: boolean,
  readBatchSize: number,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  const numOfKeys = keys.length;
  const dbInstance = await openIndexedDBDatabase();

  const durability = relaxedDurability ? "relaxed" : "default";

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog(`[idb][read-by-index][n-transaction] read`);

    const requestsData: Array<{ fullnames: string[]; key: string }> = [];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname], key });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames, key });
      }
    }

    const checksumData: number[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames, key }, index) =>
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
                const indexObj = objectStore.index(INDEX_NAME);
                const readReq = indexObj.getAll(key);
                readReq.onsuccess = function () {
                  const length = readReq.result.length;
                  if (checksumData[index] === undefined)
                    checksumData[index] = 0;
                  checksumData[index] += length;
                  resolve();
                };
                readReq.onerror = function () {
                  reject(
                    patchDOMException(readReq.error!, {
                      tags: ["idb", "read-by-index", "n-transaction"],
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
    nTransactionAverage = nTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

    removeLog(logId);
  }
  //#endregion

  //#region one transaction
  {
    const logId = addLog(`[idb][read-by-index][one-transaction] read`);
    const allPartitionKeys = getAllPossibleConvIds();
    const allTableFullnames = allPartitionKeys.map((partitionKey) =>
      getTableFullname(partitionKey)
    );
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

    const requestsData: Array<{ fullnames: string[]; key: string }> = [];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (PARTITION_MODE) {
        const fullname = getTableFullname(SELECTED_PARTITION_KEY);
        requestsData.push({ fullnames: [fullname], key });
      } else {
        const fullnames = allPartitionKeys.map(getTableFullname);
        requestsData.push({ fullnames, key });
      }
    }

    const checksumData: number[] = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames, key }, keyIndex) =>
        Promise.all(
          fullnames.map(
            (fullname) =>
              new Promise<void>((resolve, reject) => {
                const objectStore = transaction.objectStore(fullname);
                const indexObj = objectStore.index(INDEX_NAME);
                const readReq = indexObj.getAll(key);
                readReq.onsuccess = function () {
                  const length = readReq.result.length;
                  if (checksumData[keyIndex] === undefined)
                    checksumData[keyIndex] = 0;
                  checksumData[keyIndex] += length;
                  resolve();
                };
                readReq.onerror = function () {
                  reject(
                    patchDOMException(readReq.error, {
                      tags: [
                        "idb",
                        "read-by-index",
                        "one-transaction",
                        `index ${keyIndex}`,
                      ],
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
    oneTransactionAverage = oneTransactionSum / numOfKeys;

    verifyReadByIndexField(checksumData, keys);

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
  extraData?: ReadByIndexExtraData
): Promise<ReadByIndexResult> => {
  return averageFnResults(benchmarkCount, originalExecute)(
    relaxedDurability,
    readUsingBatch,
    readBatchSize,
    addLog,
    removeLog,
    extraData
  );
};
