const rawSQLite3 = require("./nativelibs/sqlite3");

let idCounter = 0;

class Database {
  constructor(filename, mode, callback) {
    this.id = ++idCounter;
    this.filename = filename;
    this.instance = new rawSQLite3.Database(filename, mode, callback);
  }

  close(callback) {
    this.instance.close(callback);
  }

  run(...args) {
    this.instance.run(...args);
  }

  get(...args) {
    this.instance.get(...args);
  }

  exec(...args) {
    this.instance.exec(...args);
  }

  serialize(...args) {
    this.instance.serialize(...args);
  }

  all(...args) {
    this.instance.all(...args);
  }
}

class SQLite3 {
  filename2ConnectionID = new Map();
  connectionID2ConnectionInstance = new Map();

  getConnectionID(filename, mode) {
    return new Promise((resolve, reject) => {
      let id = this.filename2ConnectionID.get(filename);
      if (id === undefined) {
        const instance = new Database(filename, mode, (error) => {
          if (error) {
            reject(error);
          } else {
            id = instance.id;
            this.filename2ConnectionID.set(filename, id);
            this.connectionID2ConnectionInstance.set(id, instance);
            resolve(id);
          }
        });
      } else {
        resolve(id);
      }
    });
  }

  getConnectionInstance(connectionID) {
    const instance = this.connectionID2ConnectionInstance.get(connectionID);
    if (!instance) throw new Error("Invalid connection ID");
    return instance;
  }

  close(connectionID) {
    return new Promise((resolve, reject) => {
      const instance = this.getConnectionInstance(connectionID);
      instance.close((error) => {
        if (error) reject(error);
        else {
          const filename = instance.filename;
          this.filename2ConnectionID.delete(filename);
          this.connectionID2ConnectionInstance.delete(connectionID);
          resolve();
        }
      });
    });
  }

  run(connectionID, sql, params) {
    return new Promise((resolve, reject) => {
      const instance = this.getConnectionInstance(connectionID);
      instance.run(sql, params, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    // try {
    //   const instance = this.connectionID2ConnectionInstance.get(connectionID);
    //   instance.run(sql, params, callback, ...rest);
    // } catch (e) {
    //   if (callback) callback(e);
    // }
  }

  get(connectionID, sql, params) {
    return new Promise((resolve, reject) => {
      const instance = this.getConnectionInstance(connectionID);
      instance.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
    // try {
    //   const instance = this.connectionID2ConnectionInstance.get(connectionID);
    //   instance.get(sql, params, callback, ...rest);
    // } catch (e) {
    //   if (callback) callback(e);
    // }
  }

  exec(connectionID, sql) {
    return new Promise((resolve, reject) => {
      const instance = this.getConnectionInstance(connectionID);
      instance.exec(sql, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    // try {
    //   const instance = this.connectionID2ConnectionInstance.get(connectionID);
    //   instance.exec(sql, callback);
    // } catch (e) {
    //   callback(e);
    // }
  }

  all(connectionID, sql, params) {
    return new Promise((resolve, reject) => {
      const instance = this.getConnectionInstance(connectionID);
      instance.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
    // try {
    //   const instance = this.connectionID2ConnectionInstance.get(connectionID);
    //   instance.all(sql, params, callback, ...rest);
    // } catch (e) {
    //   if (callback) callback(e);
    // }
  }

  serialize(connectionID, commandData) {
    const instance = this.getConnectionInstance(connectionID);
    instance.serialize(() => {
      commandData.forEach(({ sql, params, callback }) => {
        instance.run(sql, params, callback);
      });
    });
    // try {
    //   const instance = this.connectionID2ConnectionInstance.get(connectionID);
    //   instance.serialize(callback);
    // } catch (e) {
    //   if (callback) callback(e);
    // }
  }
}

const sqlite3 = new SQLite3();

module.exports = {
  OPEN_READONLY: rawSQLite3.OPEN_READONLY,
  OPEN_READWRITE: rawSQLite3.OPEN_READWRITE,
  OPEN_CREATE: rawSQLite3.OPEN_CREATE,
  OPEN_SHAREDCACHE: rawSQLite3.OPEN_SHAREDCACHE,
  OPEN_PRIVATECACHE: rawSQLite3.OPEN_PRIVATECACHE,
  OPEN_URI: rawSQLite3.OPEN_URI,
  getConnectionID: sqlite3.getConnectionID.bind(sqlite3),
  close: sqlite3.close.bind(sqlite3),
  all: sqlite3.all.bind(sqlite3),
  run: sqlite3.run.bind(sqlite3),
  get: sqlite3.get.bind(sqlite3),
  exec: sqlite3.exec.bind(sqlite3),
  serialize: sqlite3.serialize.bind(sqlite3),
};
