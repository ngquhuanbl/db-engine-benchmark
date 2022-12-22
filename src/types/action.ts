import { Data } from "./data";
import { IDBRange } from "./indexedDB";

export type Action<Result extends any, ExtraData extends any = undefined> = (
  data: Array<Data>,
  addLog: (content: string) => number,
  removeLog: (id: number) => void,
  extraData?: ExtraData
) => Promise<Result>;

export interface ReadAllExtraData {
	readAllCount: number;
}

export interface ReadByRangeExtraData {
	ranges: IDBRange<string>[];
}

export interface ReadFromTheEndOfSourceDataExtraData {
	readFromTheEndOfSourceDataCount: number;
}

export interface ReadByIndexExtraData {
	keys: string[];
}

export interface ReadByLimitExtraData {
	limit: number;
	count: number;
}