import { DB_NAME, TABLE_NAME, PRIMARY_KEYS, INDEX_NAME, INDEXED_KEYS } from "../../../constants/schema";
import { firstOrArray } from "../../shared/firstOrArray";


export async function openIndexedDBDatabase(): Promise<IDBDatabase> {
  const openReq = indexedDB.open(DB_NAME);
  return new Promise<IDBDatabase>((resolve, reject) => {
    openReq.onupgradeneeded = function () {
      const dbInstance = openReq.result;
      const objectStore = dbInstance.createObjectStore(TABLE_NAME, {
        keyPath: firstOrArray(PRIMARY_KEYS),
      });
      objectStore.createIndex(INDEX_NAME, firstOrArray(INDEXED_KEYS));
    };
    openReq.onsuccess = function () {
      resolve(openReq.result);
    };
    openReq.onerror = function () {
      reject(openReq.error);
    };
  });
}

export async function resetIndexedDBData(dbInstance: IDBDatabase) {
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
