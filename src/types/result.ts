export interface SingleReadWriteResult {
	nTransactionRead: number;
	nTransactionWrite: number;
	oneTransactionRead: number;
	oneTransactionWrite: number;
}

export interface ReadByRangeResult {
	nTransactionStartRange: number;
	nTransactionMiddleRange: number;
	nTransactionEndRange: number;
	oneTransactionStartRange: number;
	oneTransactionMiddleRange: number;
	oneTransactionEndRange: number;
}