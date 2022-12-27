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

  getDataset(size) {
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
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = {
  DataLoaderImpl,
};
