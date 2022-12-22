export interface SingleReadWriteResult {
	nTransactionRead: number;
	nTransactionWrite: number;
	oneTransactionRead: number;
	oneTransactionWrite: number;
}

export interface ReadByRangeResult {
	nTransactionAverage: number;
	nTransactionSum: number;
	oneTransactionAverage: number;
	oneTransactionSum: number;
}

export interface ReadAllResult {
	nTransactionAverage: number;
	nTransactionSum: number;
	oneTransactionAverage: number;
	oneTransactionSum: number;
}

export interface ReadFromTheEndOfSourceDataResult {
	nTransactionAverage: number;
	nTransactionSum: number;
	oneTransactionAverage: number;
	oneTransactionSum: number;
}

export interface ReadByIndexResult {
	nTransactionAverage: number;
	nTransactionSum: number;
	oneTransactionAverage: number;
	oneTransactionSum: number;
}

export interface ReadByLimitResult {
	nTransactionAverage: number;
	nTransactionSum: number;
	oneTransactionAverage: number;
	oneTransactionSum: number;
}