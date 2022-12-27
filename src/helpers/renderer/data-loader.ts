import { Data } from "../../types/shared/data";
import { DataLoaderCache } from "../../types/shared/data-loader";
import { DataLoader } from "../shared/data-loader";

export class DataLoaderImpl extends DataLoader {
  private static instance: DataLoaderImpl | null = null;
  private cache: DataLoaderCache | null = null;
  private constructor() {
    super();
  }

  static getInstance() {
    if (this.instance === null) {
      this.instance = new DataLoaderImpl();
    }
    return this.instance;
  }

  async getDataset(size: number): Promise<Data[]> {
    if (size === 0) return Promise.resolve([]);

    if (this.cache !== null) {
      const { size: cacheSize, data: cacheData } = this.cache;
      if (cacheSize === size) {
        return Promise.resolve(cacheData);
      }
    }

    const data = await dataLoader.getDataset(size);

    this.cache = {
      size,
      data,
    };

    return data;
  }
}
