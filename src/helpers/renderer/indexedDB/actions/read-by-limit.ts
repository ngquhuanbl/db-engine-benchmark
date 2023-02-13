import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { averageFnResults } from "../../../../types/shared/average-objects";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { getAllPossibleConvIds } from "../../../shared/generate-data";
import { patchDOMException } from "../../../shared/patch-error";
import { verifyReadByLimit } from "../../../shared/verify-result";
import { getTableFullname, openIndexedDBDatabase } from "../common";

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

  const allPartitionKeys = getAllPossibleConvIds();

  let nTransactionAverage = -1;
  let nTransactionSum = -1;
  let oneTransactionAverage = -1;
  let oneTransactionSum = -1;

  //#region n transaction
  {
    const logId = addLog("[idb][read-by-limit][n-transaction] read");

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
                const readReq = objectStore.openCursor();
                let resultLength = 0;
                readReq.onsuccess = function () {
                  const cursor = readReq.result;
                  if (cursor) {
                    resultLength += 1;

                    if (checksumData[countIndex] === undefined)
                      checksumData[countIndex] = [];
                    checksumData[countIndex].push(cursor.value.msgId);

                    if (resultLength === limit) {
                      resolve();
                    } else cursor.continue();
                  } else {
                    resolve();
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
        )
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
    const allTableFullnames = allPartitionKeys.map((partitionKey) =>
      getTableFullname(partitionKey)
    );
    const transaction = dbInstance.transaction(allTableFullnames, "readonly", {
      durability,
    });

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

    const checksumData: Array<string[]> = [];

    const start = performance.now();
    await Promise.all(
      requestsData.map(({ fullnames }, countIndex) => new Promise<void>((resolve, reject) => {
		let resultLength = 0;
		const n = fullnames.length;
		const execute = (index: number) => {
			const fullname = fullnames[index];
			const objectStore = transaction.objectStore(fullname);
			const readReq = objectStore.openCursor();
			readReq.onsuccess = () => {
				const cursor = readReq.result;
                if (cursor) {
                  resultLength += 1;
                  if (checksumData[countIndex] === undefined) checksumData[countIndex] = [];
                  checksumData[countIndex].push(cursor.value.msgId);
                  if (resultLength === limit) {
                    resolve();
                  } else cursor.continue();
                } else {
                  if (resultLength < limit && index < n - 1) {
                    execute(index + 1);
                  } else {
                    resolve();
                  }
                }
			}
			readReq.onerror = () => {
				reject(
					patchDOMException(readReq.error!, {
					  tags: ["idb", "read-by-limit", "one-transaction"],
					})
				  );
			}
		}
		execute(0);
	  }))
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
