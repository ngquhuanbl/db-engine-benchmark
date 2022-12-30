const fs = require("fs");
const path = require("path");
const StreamArray = require("stream-json/streamers/StreamArray");

class DataLoaderImpl {
  static instance = null;
  cache = null;

  static getInstance() {
    if (this.instance === null) {
      this.instance = new DataLoaderImpl();
    }
    return this.instance;
  }

  getDataset(size, onProgress) {
    if (size === 0) return Promise.resolve([]);
    // Check if hitting cache
    if (this.cache !== null) {
      const { size: cacheSize, data: cacheData } = this.cache;
      if (cacheSize === size) {
        return Promise.resolve(cacheData);
      }
    }

    try {
      const filePath = path.join(path.resolve("./"), "src", "data.json");
      const readStream = fs.createReadStream(filePath);
      const result = [];
      const stream = readStream.pipe(StreamArray.withParser());
      const progressChecker = createProgressChecker(size);
      return new Promise((resolve, reject) => {
        const customResolve = (data) => {
          resolve(data);
          setTimeout(() => {
            onProgress(0);
          });
          this.cache = { size, data };
        };
        stream.on("data", function (data) {
          result.push(data.value);
          const resultLength = result.length;

          const shouldUpdateProgress = progressChecker.check(resultLength);
          if (shouldUpdateProgress) {
            onProgress(resultLength);
          }

          if (resultLength === size) {
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
    } catch (e) {
      console.log(e);
    }
  }
}

function createProgressChecker(datasetSize) {
  let gap = 0;
  if (datasetSize <= 10) gap = Math.round(datasetSize / 2);
  else if (datasetSize <= 1000) gap = Math.round(datasetSize / 5);
  else gap = Math.round(datasetSize / 10);

  let currentMilestore = 1;
  const next = () => {
    currentMilestore = Math.min(gap + currentMilestore, datasetSize);
  };
  return {
    check(value) {
      const res = value === currentMilestore;
      if (res) {
        next();
      }
      return res;
    },
  };
}

module.exports = {
  DataLoaderImpl,
};
