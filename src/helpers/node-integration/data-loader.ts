import fs from "fs";
import path from "path";
import StreamArray from "stream-json/streamers/StreamArray";
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

  getDataset(size: number): Promise<Data[]> {
    if (size === 0) return Promise.resolve([]);

    if (this.cache !== null) {
      const { size: cacheSize, data: cacheData } = this.cache;
      if (cacheSize === size) {
        return Promise.resolve(cacheData);
      }
    }

    const filePath = path.join(path.resolve("./"), "src", "data.json");
    const readStream = fs.createReadStream(filePath);
    const result: Data[] = [];
    const stream = readStream.pipe(StreamArray.withParser());
    return new Promise((resolve, reject) => {
      const customResolve = (data) => {
        resolve(data);
        this.cache = { size, data };
      };
      stream.on("data", function (data) {
        result.push(data.value);
        if (result.length === size) {
          customResolve(result);
          stream.destroy();
        }
      });
      stream.on("end", function () {
        customResolve(result);
      });
      stream.on("error", function (err) {
        reject(err);
        stream.destroy(err);
      });
    });
  }
}
