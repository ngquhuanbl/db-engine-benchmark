import {
  DB_NAME,
  TABLE_NAME,
  PRIMARY_KEYS,
  INDEX_NAME,
  INDEXED_KEYS,
} from "../../../constants/schema";
import { firstOrArray } from "../../shared/firstOrArray";
import { getAllPossibleConvIds } from "../../shared/generate-data";

export function getTableFullname(partitionKey: string) {
  return `${TABLE_NAME}_${partitionKey}`;
}

export async function openIndexedDBDatabase(): Promise<IDBDatabase> {
  const openReq = indexedDB.open(DB_NAME);

  return new Promise<IDBDatabase>((resolve, reject) => {
    openReq.onupgradeneeded = function () {
      const dbInstance = openReq.result;
      const allPartitionKeys = getAllPossibleConvIds();
      allPartitionKeys.forEach((partitionKey) => {
        const fullName = getTableFullname(partitionKey);
        const objectStore = dbInstance.createObjectStore(fullName, {
          keyPath: firstOrArray(PRIMARY_KEYS),
        });
        objectStore.createIndex(INDEX_NAME, firstOrArray(INDEXED_KEYS));
      });
    };
    openReq.onsuccess = function () {
      resolve(openReq.result);
    };
    openReq.onerror = function () {
      reject(openReq.error);
    };
  });
}

export async function openExistedIndexedDBDatabase(): Promise<IDBDatabase> {
  const openReq = indexedDB.open(DB_NAME);
  return new Promise<IDBDatabase>((resolve, reject) => {
    openReq.onupgradeneeded = function () {
      openReq.transaction.abort();
      reject(new Error("Non-existed database"));
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
  const objectStoreNames = Array.from(dbInstance.objectStoreNames);
  for (const fullname of objectStoreNames) {
    const transaction = dbInstance.transaction(fullname, "readwrite");
    const objectStore = transaction.objectStore(fullname);
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
}
