import type {
  sqlite3,
  Database as SQLite3Database,
  RunResult,
  Statement,
} from "sqlite3";
import {
  ReceivedPortData,
  SendingPortData,
  SendingPortDataWithId,
} from "../../../types/message-channel";
import { getMsgPort } from "../../shared/get-msg-port";
export class Database implements SQLite3Database {
  constructor(private filename: string) {}

  close(callback?: ((err: Error | null) => void) | undefined): void {
    const messageChannel = MessageChannel.getInstance();
    const data: SendingPortData = {
      filename: this.filename,
      method: "close",
      params: [callback],
    };
    messageChannel.invoke(data);
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
    const messageChannel = MessageChannel.getInstance();
    const data: SendingPortData = {
      filename: this.filename,
      method: "run",
      params: [sql, params, callback],
    };
    messageChannel.invoke(data);
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
    const args = [sql, params, callback, ...rest].filter(
      (item) => item !== undefined
    );
    const messageChannel = MessageChannel.getInstance();
    const data: SendingPortData = {
      filename: this.filename,
      method: "get",
      params: args,
    };
    messageChannel.invoke(data);

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
    const args = [sql, params, callback, ...rest].filter(
      (item) => item !== undefined
    );
    const messageChannel = MessageChannel.getInstance();
    const data: SendingPortData = {
      filename: this.filename,
      method: "all",
      params: args,
    };
    messageChannel.invoke(data);

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
    const messageChannel = MessageChannel.getInstance();
    const data: SendingPortData = {
      filename: this.filename,
      method: "all",
      params: [sql, callback],
    };
    messageChannel.invoke(data);
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
      const messageChannel = MessageChannel.getInstance();
      const data: SendingPortData = {
        filename: this.filename,
        method: "serialize",
        params: [callback],
      };
      messageChannel.invoke(data);
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

export class MessageChannel {
  private static instance: MessageChannel | null = null;
  private messageHandlers = new Map<number, (e: any) => any>();

  private cachedPort: MessagePort | null = null;
  private msgId = 0;
  private constructor() {}

  private logInfo(...content: any[]) {
    const tags = ["message-channel"];
    console.log(`[${tags.join("][")}]`, ...content);
  }

  private logError(...content: any[]) {
    const tags = ["message-channel"];
    console.error(`[${tags.join("][")}]`, ...content);
  }

  static getInstance() {
    if (this.instance === null) {
      this.instance = new MessageChannel();
    }
    return this.instance;
  }

  private async getPort(): Promise<MessagePort> {
    if (!this.cachedPort) {
      this.cachedPort = await getMsgPort();
      this.cachedPort.onmessage = (event) => {
        const msg = event.data;
        const { id } = msg;
        const messageHandler = this.messageHandlers.get(id);
        if (messageHandler) {
          messageHandler(msg);
          this.messageHandlers.delete(id);
        } else {
          this.logError(`Found no handler for message with id of '${id}'`);
        }
      };
    }

    return this.cachedPort;
  }

  async invoke(data: SendingPortData) {
    const paramsWithoutCallback: any[] = [];
    let callback: ((error: Error, result?: any) => void) | null = null;

    for (const param of data.params) {
      if (typeof param === "function") {
        callback = param;
      } else {
        paramsWithoutCallback.push(param);
      }
    }

    return new Promise<void>(async (resolve) => {
      const currentId = this.msgId++;
      const packedData: SendingPortDataWithId = {
        ...data,
        params: paramsWithoutCallback,
        id: currentId,
      };
      const port = await this.getPort();
      port.postMessage(packedData);

      const messageHandler = (data: ReceivedPortData) => {
        const { error, result } = data;
        if (callback) {
          callback(error, result);
        }
        resolve();
      };
      this.messageHandlers.set(currentId, messageHandler);
    });
  }
}

const consumableSQLite3: sqlite3 = {
  // @ts-ignore
  Database,
};

export default consumableSQLite3;
