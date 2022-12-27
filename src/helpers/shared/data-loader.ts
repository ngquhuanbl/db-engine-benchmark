import { Data } from "../../types/shared/data";

export abstract class DataLoader {
	abstract getDataset(size: number): Promise<Data[]>;
}