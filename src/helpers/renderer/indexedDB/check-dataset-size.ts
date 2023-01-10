
import { TABLE_NAME } from "../../../constants/schema";
import { openIndexedDBDatabase } from "./common";

export async function checkDatasetSize(): Promise<number> {
	const dbInstance = await openIndexedDBDatabase()
	const transaction = dbInstance.transaction(TABLE_NAME, 'readonly');
	const objectStore = transaction.objectStore(TABLE_NAME);
	return new Promise<number>((resolve) => {
		const getReq = objectStore.count();
		getReq.onsuccess = function() {
			resolve(getReq.result);
		}
		getReq.onerror = function() {
			console.error('Failed to load data!', getReq.error);
			resolve(0);
		}
	});
}