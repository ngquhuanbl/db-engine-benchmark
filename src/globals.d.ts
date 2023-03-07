import { sqlite3 } from "sqlite3";
import { CommandData } from "./types/shared/sqlite";
import type {
  ReadAllExtraData,
  ReadByIndexExtraData,
  ReadByLimitExtraData,
  ReadByRangeExtraData,
  ReadFromEndSourceExtraData,
} from "./types/renderer/action";
import {
  ReadAllResult,
  ReadByIndexResult,
  ReadByLimitResult,
  ReadByRangeResult,
  ReadFromEndSourceResult,
  SingleReadWriteResult,
} from "./types/shared/result";
import { Data } from "./types/shared/data";
import { Message } from "./types/shared/message-port";
import { FullResult } from "./helpers/shared/execute/constants";
import { SocketInfo } from './types/socket';

declare global {
  var preloadedSQLite3: {
    Database: {
      OPEN_READONLY: number;
      OPEN_READWRITE: number;
      OPEN_CREATE: number;
      OPEN_SHAREDCACHE: number;
      OPEN_PRIVATECACHE: number;
      OPEN_URI: number;

      getConnectionID(
        filename: string,
        callback?: (error: Error | null, connectionID: string) => void
      ): void;

      close(
        connectionID: string,
        callback?: (error: Error | null) => void
      ): void;

      run(
        connectionID: string,
        sql: string,
        callback?: (error: Error | null) => void
      ): Promise<void>;
      run(
        connectionID: string,
        sql: string,
        params: any,
        callback?: (error: Error | null) => void
      ): void;
      run(connectionID: string, sql: string, ...params: any[]): void;

      get(
        connectionID: string,
        sql: string,
        callback?: (error: Error | null, row: any) => void
      ): void;
      get(
        connectionID: string,
        sql: string,
        params: any,
        callback?: (error: Error | null, row: any) => void
      ): void;
      get(connectionID: string, sql: string, ...params: any[]): void;

      all(
        connectionID: string,
        sql: string,
        callback?: (error: Error | null, rows: any[]) => void
      ): void;
      all(
        connectionID: string,
        sql: string,
        params: any,
        callback?: (error: Error | null, rows: any[]) => void
      ): void;
      all(connectionID: string, sql: string, ...params: any[]): void;

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
      exec(
        connectionID: string,
        sql: string,
        callback?: (error: Error | null) => void
      ): Promise<void>;
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
      serialize(
        connectionID: string,
        callback: (conn: sqlite3.Database) => void
      ): Promise<void>;
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
    getDBFilePath: (dbName: string, convId: string) => Promise<string>;
    join: (...paths) => Promise<string>;
  };
  var __BUNDLENAME__: { value: string };
  var dataLoader: {
    getDataset: (size: number) => Promise<Data[]>;
    addProgressListener: (
      listener: (event: any, value: number) => void
    ) => void;
  };

  var messageBroker: {
    addMessageListener: (
      listener: (event: any, message: Message) => void
    ) => void;
    removeMessageListener: (
      listener: (event: any, message: Message) => void
    ) => void;
    sendMessage: (message: Message) => void;
  };
  var PARTITION_MODE: boolean;
  var SELECTED_PARTITION_KEY: string;
  var VERIFY_MODE_ON: boolean;

  var resultHandler: {
    write: (message: {
      datasetSize: number;
      benchmarkCount: number;
      result: Partial<FullResult>;
    }) => void;
  };

  var socketConfig: {
    get: () => Promise<SocketInfo>;
  };
}
