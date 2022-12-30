import { createPool, Pool } from "generic-pool";
import { Database } from "sqlite3";

type FnConnectionSqlite = (mode: TransactionMode) => Promise<Database>;

enum TransactionMode {
  READONLY = "readonly",
  READWRITE = "readwrite",
}

export class ConnectionPool {
  private writerQueue: Pool<Database>;
  private readerQueue: Pool<Database>;
  private availableToRead: boolean = true;
  private availableToWrite: boolean = true;
  private writeCountUtilsDoOptimize: number = 0;
  private intervalOptimizer?: NodeJS.Timeout = undefined;
  private readerConnections: Database[] = [];
  private writerConnection: Database;

  constructor(
    numReaders: number,
    createConnection: () => Promise<Database>
  ) {
    this.readerQueue = this.createReadPool(createConnection, numReaders);
    this.writerQueue = this.createWritePool(createConnection());
  }

  run(...args: any[]) {
    return this.use(TransactionMode.READWRITE, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      // @ts-ignore
      return connection.run(...args);
    });
  }

  get(...args: any[]) {
    return this.use(TransactionMode.READONLY, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      // @ts-ignore
      return connection.get(...args);
    });
  }

  all(...args: any[]) {
    return this.use(TransactionMode.READONLY, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      // @ts-ignore
      return connection.all(...args);
    });
  }

  exec(...args: any[]) {
    return this.use(TransactionMode.READONLY, async (connection) => {
      // if (__DATABASE_DEBUG_LOG__) {
      // 	this.printDebug(query, params);
      // }
      // @ts-ignore
      return connection.exec(...args);
    });
  }

  serialize(callback) {
    return this.use(TransactionMode.READONLY, async (connection) => {
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

  private use<T>(
    mode: TransactionMode,
    callback: (connection: Database) => Promise<T>
  ) {
    return new Promise<T>((rs, rj) => {
      const handler = async (connection: Database) => {
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

  private createWritePool(createWriteConnection: Promise<Database>): Pool<Database> {
    return createPool(
      {
        create: () => {
          return createWriteConnection;
        },
        destroy: async (connection) => {
          console.debug("fk");
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

  private createReadPool(connect: FnConnectionSqlite, readers: number) {
    return createPool(
      {
        create: async () => {
          const connection = await connect(TransactionMode.READONLY);
          this.readerConnections.push(connection);
          return connection;
        },
        destroy: async (connection) => {
          console.debug("fk");
          return connection.close();
        },
      },
      { max: readers, min: 0, autostart: true }
    );
  }

  private optimize = async () => {
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
