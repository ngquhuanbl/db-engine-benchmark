import { sqlite3 } from "sqlite3";
import { CommandData } from "./types/sqlite";

declare global {
  var rawSqlite3: {
    Database: {
      OPEN_READONLY: number;
      OPEN_READWRITE: number;
      OPEN_CREATE: number;
      OPEN_SHAREDCACHE: number;
      OPEN_PRIVATECACHE: number;
      OPEN_URI: number;
      getConnectionID(filename: string, mode?: number): Promise<string>;
      close(connectionID: string): Promise<void>;
      run(connectionID: string, sql: string): Promise<void>;
      run(connectionID: string, sql: string, params: any): Promise<void>;
      run(connectionID: string, sql: string, ...params: any[]): Promise<void>;
      run(
        connectionID: string,
        sql: unknown,
        params?: unknown,
        ...rest: unknown[]
      ): Promise<void>;
      get(connectionID: string, sql: string): Promise<any>;
      get(connectionID: string, sql: string, params: any): Promise<any>;
      get(connectionID: string, sql: string, ...params: any[]): Promise<any>;
      get(
        connectionID: string,
        sql: unknown,
        params?: unknown,
        ...rest: unknown[]
      ): Promise<any>;
      all(connectionID: string, sql: string): Promise<any[]>;
      all(connectionID: string, sql: string, params: any): Promise<any[]>;
      all(connectionID: string, sql: string, ...params: any[]): Promise<any[]>;
      all(
        connectionID: string,
        sql: unknown,
        params?: unknown,
        ...rest: unknown[]
      ): Promise<any[]>;
      //   each(
      //     sql: string,
      //     callback?:
      //       | ((err: Error | null, row: any) => void)
      //       | undefined,
      //     complete?: ((err: Error | null, count: number) => void) | undefined
      //   ): void;
      //   each(
      //     sql: string,
      //     params: any,
      //     callback?:
      //       | ((err: Error | null, row: any) => void)
      //       | undefined,
      //     complete?: ((err: Error | null, count: number) => void) | undefined
      //   ): void;
      //   each(sql: string, ...params: any[]): void;
      //   each(
      //     sql: unknown,
      //     params?: unknown,
      //     callback?: unknown,
      //     complete?: unknown,
      //     ...rest: unknown[]
      //   ): void;
      exec(connectionID: string, sql: string): Promise<void>;
      //   prepare(
      //     sql: string,
      //     callback?: ((err: Error | null) => void) | undefined
      //   ): Statement;
      //   prepare(
      //     sql: string,
      //     params: any,
      //     callback?: ((err: Error | null) => void) | undefined
      //   ): Statement;
      //   prepare(sql: string, ...params: any[]): Statement;
      //   prepare(
      //     sql: unknown,
      //     params?: unknown,
      //     callback?: unknown,
      //     ...rest: unknown[]
      //   ): Statement;
      serialize(connectionID: string, commandData: CommandData): Promise<void>;
      //   parallelize(callback?: (() => void) | undefined): void;
      //   on(event: "trace", listener: (sql: string) => void): void;
      //   on(event: "profile", listener: (sql: string, time: number) => void): void;
      //   on(event: "error", listener: (err: Error) => void): void;
      //   on(event: "open" | "close", listener: () => void): void;
      //   on(event: string, listener: (...args: any[]) => void): void;
      //   on(event: unknown, listener: unknown): void;
      //   configure(option: "busyTimeout", value: number): void;
      //   interrupt(): void;
      //   addListener(
      //     eventName: string | symbol,
      //     listener: (...args: any[]) => void
      //   ): void;
      //   once(
      //     eventName: string | symbol,
      //     listener: (...args: any[]) => void
      //   ): void;
      //   removeListener(
      //     eventName: string | symbol,
      //     listener: (...args: any[]) => void
      //   ): void;
      //   off(eventName: string | symbol, listener: (...args: any[]) => void): void;
      //   removeAllListeners(event?: string | symbol | undefined): void;
      //   setMaxListeners(n: number): void;
      //   getMaxListeners(): number;
      //   listeners(eventName: string | symbol): Function[];
      //   rawListeners(eventName: string | symbol): Function[];
      //   emit(eventName: string | symbol, ...args: any[]): boolean;
      //   listenerCount(eventName: string | symbol): number;
      //   prependListener(
      //     eventName: string | symbol,
      //     listener: (...args: any[]) => void
      //   ): void;
      //   prependOnceListener(
      //     eventName: string | symbol,
      //     listener: (...args: any[]) => void
      //   ): void;
      //   eventNames(): (string | symbol)[];
    };
  };
  var path: {
    getUserPath: () => Promise<string>;
    join: (...paths) => Promise<string>;
  };
}
