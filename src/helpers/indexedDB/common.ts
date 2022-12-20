import { DB_NAME, PRIMARY_KEYS, TABLE_NAME } from "../../constants/schema";

export async function openIndexdDBDatabase(): Promise<IDBDatabase> {
  const openReq = indexedDB.open(DB_NAME);
  return new Promise<IDBDatabase>((resolve, reject) => {
    openReq.onupgradeneeded = function () {
      const dbInstance = openReq.result;
      dbInstance.createObjectStore(TABLE_NAME, { keyPath: PRIMARY_KEYS });
    };
    openReq.onsuccess = function () {
      resolve(openReq.result);
    };
    openReq.onerror = function () {
      reject(openReq.error);
    };
  });
}

export async function resetIndexedDBData(dbInstance: IDBDatabase, ) {
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
  })
}
