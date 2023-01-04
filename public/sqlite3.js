const sqlite3 = require("../nativelibs/sqlite3");
const { createPool } = require("generic-pool");

const TransactionMode = {
  READONLY: "readonly",
  READWRITE: "readwrite",
};

let idCounter = 0;

const SQLITE_OPEN_MODE = {
  OPEN_READONLY: 0x00000001,
  OPEN_READWRITE: 0x00000002,
  OPEN_CREATE: 0x00000004,
  OPEN_DELETE_ON_CLOSE: 0x00000008,
  OPEN_EXCLUSIVE: 0x00000010,
  OPEN_AUTO_PROXY: 0x00000020,
  OPEN_URI: 0x00000040,
  OPEN_MEMORY: 0x00000080,
  OPEN_MAIN_DB: 0x00000100,
  OPEN_TEMP_DB: 0x00000200,
  OPEN_TRANSIENT_DB: 0x00000400,
  OPEN_MAIN_JOURNAL: 0x00000800,
  OPEN_TEMP_JOURNAL: 0x00001000,
  OPEN_SUB_JOURNAL: 0x00002000,
  OPEN_SUPER_JOURNAL: 0x00004000,
  OPEN_NO_MUTEX: 0x00008000,
  OPEN_FULL_MUTEX: 0x00010000,
  OPEN_SHARED_CACHE: 0x00020000,
  OPEN_PRIVATE_CACHE: 0x00040000,
  OPEN_WAL: 0x00080000,
  OPEN_NOFOLLOW: 0x01000000,
};

const Z_OPEN_MODE =
  SQLITE_OPEN_MODE.OPEN_READWRITE |
  SQLITE_OPEN_MODE.OPEN_CREATE |
  SQLITE_OPEN_MODE.OPEN_WAL |
  SQLITE_OPEN_MODE.OPEN_PRIVATE_CACHE;

const NUM_READ = 2;

class Database {
  constructor(filename) {
    this.id = ++idCounter;
    this.filename = filename;
    const createConnection = () =>
      new Promise((resolve, reject) => {
        const conn = new sqlite3.Database(filename, Z_OPEN_MODE, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(conn);
          }
        });
      });
    this.pool = new ConnectionPool(NUM_READ, createConnection);
  }

  close() {
    this.pool.close();
  }

  run(...args) {
    this.pool.run(...args);
  }

  get(...args) {
    this.pool.get(...args);
  }

  exec(...args) {
    this.pool.exec(...args);
  }

  serialize(...args) {
    this.pool.serialize(...args);
  }

  all(...args) {
    this.pool.all(...args);
  }
}

class ConnectionPool {
  //  writerQueue: Pool<SqlConnection>;
  //  readerQueue: Pool<SqlConnection>;
  availableToRead = true;
  availableToWrite = true;
  writeCountUtilsDoOptimize = 0;
  intervalOptimizer = undefined;
  readerConnections = [];

  constructor(numReaders, createConnection) {
    this.readerQueue = this.createReadPool(createConnection, numReaders);
    this.writerQueue = this.createWritePool(createConnection());
  }

  run(...args) {
    return this.use(TransactionMode.READWRITE, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      return connection.run(...args);
    });
  }

  get(...args) {
    return this.use(TransactionMode.READONLY, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      return connection.get(...args);
    });
  }

  all(...args) {
    return this.use(TransactionMode.READONLY, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      return connection.all(...args);
    });
  }

  exec(...args) {
    return this.use(TransactionMode.READONLY, (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      return connection.exec(...args);
    });
  }

  serialize(callback) {
    return this.use(TransactionMode.READONLY, (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      return connection.serialize(() =>
        callback({
          run: connection.run.bind(connection),
          get: connection.get.bind(connection),
          exec: connection.exec.bind(connection),
          all: connection.all.bind(connection),
        })
      );
    });
  }

  async close() {
    this.availableToWrite = false;
    this.availableToRead = false;
    await this.readerQueue.clear();
    await this.writerQueue.clear();
  }

  use(mode, callback) {
    return new Promise((rs, rj) => {
      const handler = async (connection) => {
        const result = callback(connection);
        if (result && result.then) {
          return result.then(rs).catch(rj);
        }
        rs(result);
      };
      if (mode === TransactionMode.READONLY) {
        if (this.availableToRead) {
          return this.readerQueue.use(handler);
        }
      }
      if (this.availableToWrite) {
        return this.writerQueue.use(handler);
      }
      rj(new Error("No connections in pool!"));
    });
  }

  createWritePool(createWriteConnection) {
    return createPool(
      {
        create: async () => {
          return createWriteConnection;
        },
        destroy: async (connection) => {
          return connection.close();
        },
      },
      {
        max: 1,
        min: 1,
        autostart: true,
      }
    );
  }

  createReadPool(connect, readers) {
    return createPool(
      {
        create: async () => {
          const connection = await connect();
          this.readerConnections.push(connection);
          return connection;
        },
        destroy: (connection) => {
          return connection.close();
        },
      },
      { max: readers, min: 0, autostart: true }
    );
  }

  optimize = async () => {
    // this._writeCountUtilsDoOptimize--;
    // if (this._writeCountUtilsDoOptimize < 0) {
    // 	this._writeCountUtilsDoOptimize = 20;
    // 	this._writeAvaiables = false;
    // 	this._readAvaiables = false;
    // 	console.debug(
    // 		'optimize closing all reader',
    // 		this._readerConnections.length
    // 	);
    // 	await Promise.all(
    // 		this._readerConnections.map((connection) => {
    // 			return connection.close();
    // 		})
    // 	);
    // 	console.debug('run optimize write');
    // 	// await this._writerConnection
    // 	// 	.run({
    // 	// 		query: 'PRAGMA wal_checkpoint(TRUNCATE);',
    // 	// 		params: 0,
    // 	// 	})
    // 	// 	.catch((error) => {
    // 	// 		console.debug('run optimize write error', error);
    // 	// 	});
    // 	await this._writerConnection.close().catch((error) => {
    // 		console.debug('run optimize write error 2', error);
    // 	});
    // 	console.debug('run optimize done');
    // }
  };
}

class SQLite3 {
  filename2ConnectionID = new Map();
  connectionID2ConnectionInstance = new Map();

  getConnectionID(filename, callback) {
    let id = this.filename2ConnectionID.get(filename);
    if (id === undefined) {
      const instance = new Database(filename);
      const id = instance.id;
      this.filename2ConnectionID.set(filename, id);
      this.connectionID2ConnectionInstance.set(id, instance);
      callback(null, id);
    } else {
      callback(null, id);
    }
  }

  getConnectionInstance(connectionID) {
    const instance = this.connectionID2ConnectionInstance.get(connectionID);
    if (!instance) throw new Error("Invalid connection ID");
    return instance;
  }

  close(connectionID, callback) {
    const instance = this.getConnectionInstance(connectionID);
    instance.close((error) => {
      if (error) callback(error);
      else {
        const filename = instance.filename;
        this.filename2ConnectionID.delete(filename);
        this.connectionID2ConnectionInstance.delete(connectionID);
        callback(null);
      }
    });
  }

  run(connectionID, ...args) {
    const instance = this.getConnectionInstance(connectionID);
    instance.run(...args);
  }

  get(connectionID, ...args) {
    const instance = this.getConnectionInstance(connectionID);
    instance.get(...args);
  }

  exec(connectionID, ...args) {
    const instance = this.getConnectionInstance(connectionID);
    instance.exec(...args);
  }

  all(connectionID, ...args) {
    const instance = this.getConnectionInstance(connectionID);
    instance.all(...args);
  }

  serialize(connectionID, callback) {
    const instance = this.getConnectionInstance(connectionID);
    instance.serialize(callback);
  }
}

const wrappedSQLite3 = new SQLite3();

module.exports = {
  OPEN_READONLY: wrappedSQLite3.OPEN_READONLY,
  OPEN_READWRITE: wrappedSQLite3.OPEN_READWRITE,
  OPEN_CREATE: wrappedSQLite3.OPEN_CREATE,
  OPEN_SHAREDCACHE: wrappedSQLite3.OPEN_SHAREDCACHE,
  OPEN_CACHE: wrappedSQLite3.OPEN_CACHE,
  OPEN_URI: wrappedSQLite3.OPEN_URI,
  getConnectionID: wrappedSQLite3.getConnectionID.bind(wrappedSQLite3),
  close: wrappedSQLite3.close.bind(wrappedSQLite3),
  all: wrappedSQLite3.all.bind(wrappedSQLite3),
  run: wrappedSQLite3.run.bind(wrappedSQLite3),
  get: wrappedSQLite3.get.bind(wrappedSQLite3),
  exec: wrappedSQLite3.exec.bind(wrappedSQLite3),
  serialize: wrappedSQLite3.serialize.bind(wrappedSQLite3),
};
