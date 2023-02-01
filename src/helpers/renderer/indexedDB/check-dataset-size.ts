
import { openExistedIndexedDBDatabase } from "./common";

export async function checkDatasetSize(): Promise<number> {
	let dbInstance: IDBDatabase | null = null;
	try {
		dbInstance = await openExistedIndexedDBDatabase();
	} catch(e) {
		return 0;
	}
	
	const objectStoreNames = Array.from(dbInstance.objectStoreNames);
	
	let size = 0;
	for (const storeName of objectStoreNames) {
		const transaction = dbInstance.transaction(storeName, 'readonly');
		const objectStore = transaction.objectStore(storeName);
		await new Promise<void>((resolve) => {
			const getReq = objectStore.count();
			getReq.onsuccess = function() {
				size += getReq.result;
				resolve();
			}
			getReq.onerror = function() {
				console.error('Failed to load data!', getReq.error);
				resolve();
			}
		});
	}
	return size;
}