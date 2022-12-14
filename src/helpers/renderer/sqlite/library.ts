import type {
  sqlite3,
  Database as SQLite3Database,
  RunResult,
  Statement,
} from "sqlite3";
import { AsyncContainer } from "../../shared/async-container";
export class Database implements SQLite3Database {
  static OPEN_READONLY = preloadedSQLite3.Database.OPEN_READONLY;
  static OPEN_READWRITE = preloadedSQLite3.Database.OPEN_READWRITE;
  static OPEN_CREATE = preloadedSQLite3.Database.OPEN_CREATE;
  static OPEN_SHAREDCACHE = preloadedSQLite3.Database.OPEN_SHAREDCACHE;
  static OPEN_PRIVATECACHE = preloadedSQLite3.Database.OPEN_PRIVATECACHE;
  static OPEN_URI = preloadedSQLite3.Database.OPEN_URI;

  private connectionIDContainer: AsyncContainer<string>;

  constructor(
    filename: string,
    mode?: number,
    callback?: (err: Error | null) => void
  ) {
    this.connectionIDContainer = new AsyncContainer();

    preloadedSQLite3.Database.getConnectionID(
      filename,
      mode,
      (error, connectionID) => {
        if (error) {
          this.connectionIDContainer.reject(error);
          if (callback) callback(error);
        } else {
          this.connectionIDContainer.resolve(connectionID);
          if (callback) callback(null);
        }
      }
    );
  }

  private async getConnectionID(): Promise<string> {
    const res: string | undefined = this.connectionIDContainer.value;

    if (res === undefined) {
      return await this.connectionIDContainer.promise;
    }
    return res;
  }

  close(callback?: ((err: Error | null) => void) | undefined): void {
    this.getConnectionID().then((connectionID) =>
      preloadedSQLite3.Database.close(connectionID, callback)
    );
  }

  run(
    sql: string,
    callback?: ((this: RunResult, err: Error | null) => void) | undefined
  ): this;
  run(
    sql: string,
    params: any,
    callback?: ((this: RunResult, err: Error | null) => void) | undefined
  ): this;
  run(sql: string, ...params: any[]): this;
  run(sql: string, params?: unknown, callback?: any, ...rest: unknown[]): this {
    this.getConnectionID().then((connectionID) => {
      const args = [sql, params, callback, ...rest].filter(
        (item) => item !== undefined
      );
      // @ts-ignore
      preloadedSQLite3.Database.run(connectionID, ...args);
    });
    return this;
  }

  get(
    sql: string,
    callback?:
      | ((this: Statement, err: Error | null, row: any) => void)
      | undefined
  ): this;
  get(
    sql: string,
    params: any,
    callback?:
      | ((this: Statement, err: Error | null, row: any) => void)
      | undefined
  ): this;
  get(sql: string, ...params: any[]): this;
  get(sql: string, params?: unknown, callback?: any, ...rest: unknown[]): this {
    this.getConnectionID().then((connectionID) => {
      const args = [sql, params, callback, ...rest].filter(
        (item) => item !== undefined
      );
      // @ts-ignore
      preloadedSQLite3.Database.get(connectionID, ...args);
    });

    return this;
  }

  all(
    sql: string,
    callback?: ((err: Error | null, rows: any[]) => void) | undefined
  ): this;
  all(
    sql: string,
    params: any,
    callback?: ((err: Error | null, rows: any[]) => void) | undefined
  ): this;
  all(sql: string, ...params: any[]): this;
  all(sql: string, params?: any, callback?: any, ...rest: unknown[]): this {
    this.getConnectionID().then((connectionID) => {
      const args = [sql, params, callback, ...rest].filter(
        (item) => item !== undefined
      );
      // @ts-ignore
      return preloadedSQLite3.Database.all(connectionID, ...args);
    });

    return this;
  }
  each(
    sql: string,
    callback?:
      | ((this: Statement, err: Error | null, row: any) => void)
      | undefined,
    complete?: ((err: Error | null, count: number) => void) | undefined
  ): this;
  each(
    sql: string,
    params: any,
    callback?:
      | ((this: Statement, err: Error | null, row: any) => void)
      | undefined,
    complete?: ((err: Error | null, count: number) => void) | undefined
  ): this;
  each(sql: string, ...params: any[]): this;
  each(
    sql: unknown,
    params?: unknown,
    callback?: unknown,
    complete?: unknown,
    ...rest: unknown[]
  ): this {
    throw new Error("Method not implemented.");
  }
  exec(
    sql: string,
    callback?: ((this: Statement, err: Error | null) => void) | undefined
  ): this {
    this.getConnectionID().then((connectionID) =>
      preloadedSQLite3.Database.exec(connectionID, sql, callback)
    );
    return this;
  }
  prepare(
    sql: string,
    callback?: ((this: Statement, err: Error | null) => void) | undefined
  ): Statement;
  prepare(
    sql: string,
    params: any,
    callback?: ((this: Statement, err: Error | null) => void) | undefined
  ): Statement;
  prepare(sql: string, ...params: any[]): Statement;
  prepare(
    sql: unknown,
    params?: unknown,
    callback?: unknown,
    ...rest: unknown[]
  ): import("sqlite3").Statement {
    throw new Error("Method not implemented.");
  }
  serialize(callback?: ((conn: Database) => void) | undefined): void {
    if (callback) {
      this.getConnectionID().then((connectionID) =>
        preloadedSQLite3.Database.serialize(connectionID, callback)
      );
    }
  }
  parallelize(callback?: (() => void) | undefined): void {
    throw new Error("Method not implemented.");
  }
  on(event: "trace", listener: (sql: string) => void): this;
  on(event: "profile", listener: (sql: string, time: number) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "open" | "close", listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: unknown, listener: unknown): this {
    throw new Error("Method not implemented.");
  }
  configure(option: "busyTimeout", value: number): void {
    throw new Error("Method not implemented.");
  }
  interrupt(): void {
    throw new Error("Method not implemented.");
  }
  addListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    throw new Error("Method not implemented.");
  }
  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error("Method not implemented.");
  }
  removeListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    throw new Error("Method not implemented.");
  }
  off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error("Method not implemented.");
  }
  removeAllListeners(event?: string | symbol | undefined): this {
    throw new Error("Method not implemented.");
  }
  setMaxListeners(n: number): this {
    throw new Error("Method not implemented.");
  }
  getMaxListeners(): number {
    throw new Error("Method not implemented.");
  }
  listeners(eventName: string | symbol): Function[] {
    throw new Error("Method not implemented.");
  }
  rawListeners(eventName: string | symbol): Function[] {
    throw new Error("Method not implemented.");
  }
  emit(eventName: string | symbol, ...args: any[]): boolean {
    throw new Error("Method not implemented.");
  }
  listenerCount(eventName: string | symbol): number {
    throw new Error("Method not implemented.");
  }
  prependListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    throw new Error("Method not implemented.");
  }
  prependOnceListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    throw new Error("Method not implemented.");
  }
  eventNames(): (string | symbol)[] {
    throw new Error("Method not implemented.");
  }
}

const consumableSQLite3: sqlite3 = {
  // @ts-ignore
  Database,
};

export default consumableSQLite3;
