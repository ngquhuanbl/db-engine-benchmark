import { TABLE_NAME } from "../../constants/schema";
import { Data } from "../../types/data";
import { openIndexdDBDatabase } from "./common";

export async function loadData(): Promise<Data[]> {
	const dbInstance = await openIndexdDBDatabase()
	const transaction = dbInstance.transaction(TABLE_NAME, 'readonly');
	const objectStore = transaction.objectStore(TABLE_NAME);
	return new Promise<Data[]>((resolve) => {
		const getReq = objectStore.getAll();
		getReq.onsuccess = function() {
			resolve(getReq.result);
		}
		getReq.onerror = function() {
			console.error('Failed to load data!', getReq.error);
			resolve([]);
		}
	});
}