import { IDBRange } from "../shared/indexedDB";

export interface ReadAllExtraData {
	readAllCount: number;
}

export interface ReadByRangeExtraData {
	ranges: IDBRange<string>[];
}

export interface ReadFromEndSourceExtraData {
	readFromEndSourceCount: number;
}

export interface ReadByIndexExtraData {
	keys: string[];
}

export interface ReadByLimitExtraData {
	limit: number;
	count: number;
}