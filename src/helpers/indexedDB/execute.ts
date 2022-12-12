import { DB_NAME, TABLE_NAME } from "../../constants/schema";
import { Data } from "../../types/data";
import { Result } from "../../types/result";
import { patchDOMException } from "../patch-error";

export async function execute(data: Array<Data>): Promise<Result> {
  const dbInstance = await openDatabase();
  
  async function resetData() {
	const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
	const objectStore = transaction.objectStore(TABLE_NAME);
	const clearReq = objectStore.clear();
	await new Promise<void>((resolve, reject) => {
	  clearReq.onsuccess = function () {
		resolve();
	  };
	  clearReq.onerror = function () {
		reject(clearReq.error);
	  };
	});
  }
  
  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;
  // WRITE
  {
    const start = performance.now();
    await Promise.all(
      data.map((item) => {
        const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
        const objectStore = transaction.objectStore(TABLE_NAME);
        const writeReq = objectStore.add(item);
        return new Promise<void>((resolve, reject) => {
          writeReq.onsuccess = function () {
            resolve();
          };
          writeReq.onerror = function () {
            reject(
              patchDOMException(writeReq.error!, {
                tags: ["idb", "n-transaction", "write"],
              })
            );
          };
        });
      })
    );
    const end = performance.now();
    nTransactionWrite = end - start;
  }

  // READ
  {
    const start = performance.now();
    await Promise.all(
      data.map((item) => {
        const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
        const objectStore = transaction.objectStore(TABLE_NAME);
        const readReq = objectStore.get(item.msgId);
        return new Promise<void>((resolve, reject) => {
          readReq.onsuccess = function () {
            resolve();
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "n-transaction", "read"],
              })
            );
          };
        });
      })
    );
    const end = performance.now();
    nTransactionRead = end - start;
  }
  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransactionRead = -1;
  let oneTransactionWrite = -1;
  // WRITE
  {
    const start = performance.now();
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
    const objectStore = transaction.objectStore(TABLE_NAME);
    await Promise.all(
      data.map((item) => {
        const writeReq = objectStore.add(item);
        return new Promise<void>((resolve, reject) => {
          writeReq.onsuccess = function () {
            resolve();
          };
          writeReq.onerror = function () {
            reject(
              patchDOMException(writeReq.error!, {
                tags: ["idb", "one-transaction", "write"],
              })
            );
          };
        });
      })
    );
    const end = performance.now();
    oneTransactionWrite = end - start;
  }
  // READ
  {
    const start = performance.now();
    const transaction = dbInstance.transaction(TABLE_NAME, "readwrite");
    const objectStore = transaction.objectStore(TABLE_NAME);
    await Promise.all(
      data.map((item) => {
        const readReq = objectStore.get(item.msgId);
        return new Promise<void>((resolve, reject) => {
          readReq.onsuccess = function () {
            resolve();
          };
          readReq.onerror = function () {
            reject(
              patchDOMException(readReq.error!, {
                tags: ["idb", "one-transaction", "read"],
              })
            );
          };
        });
      })
    );
    const end = performance.now();
    oneTransactionRead = end - start;
  }

  //#endregion
  return {
    nTransactionRead,
    nTransactionWrite,
    oneTransactionRead,
    oneTransactionWrite,
  };
}

async function openDatabase(): Promise<IDBDatabase> {
  const openReq = indexedDB.open(DB_NAME);
  return new Promise<IDBDatabase>((resolve, reject) => {
    openReq.onupgradeneeded = function () {
      const dbInstance = openReq.result;
      dbInstance.createObjectStore(TABLE_NAME, { keyPath: "msgId" });
    };
    openReq.onsuccess = function () {
      resolve(openReq.result);
    };
    openReq.onerror = function () {
      reject(openReq.error);
    };
  });
}
