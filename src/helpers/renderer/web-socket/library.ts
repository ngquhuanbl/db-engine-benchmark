import type {
  sqlite3,
  Database as SQLite3Database,
  RunResult,
  Statement,
} from "sqlite3";
import {
  ReceivedSocketData,
  SendingSocketData,
  SendingSocketDataWithAuth,
  SocketInfo,
} from "../../../types/socket";
import { AsyncContainer } from "../../shared/async-container";
export class Database implements SQLite3Database {
  constructor(private filename: string) {}

  close(callback?: ((err: Error | null) => void) | undefined): void {
    const socket = SQLiteSocket.getInstance();
    const data: SendingSocketData = {
      filename: this.filename,
      method: "close",
      params: [callback],
    };
    socket.invoke(data);
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
    const socket = SQLiteSocket.getInstance();
    const data: SendingSocketData = {
      filename: this.filename,
      method: "run",
      params: [sql, params, callback],
    };
    socket.invoke(data);
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
    const socket = SQLiteSocket.getInstance();
    const data: SendingSocketData = {
      filename: this.filename,
      method: "get",
      params: args,
    };
    socket.invoke(data);

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
    const socket = SQLiteSocket.getInstance();
    const data: SendingSocketData = {
      filename: this.filename,
      method: "all",
      params: args,
    };
    socket.invoke(data);

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
    const socket = SQLiteSocket.getInstance();
    const data: SendingSocketData = {
      filename: this.filename,
      method: "all",
      params: [sql, callback],
    };
    socket.invoke(data);
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
      const socket = SQLiteSocket.getInstance();
      const data: SendingSocketData = {
        filename: this.filename,
        method: "serialize",
        params: [callback],
      };
      socket.invoke(data);
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

export class SQLiteSocket {
  private static instance: SQLiteSocket | null = null;
  private socketInfoContainer = new AsyncContainer<SocketInfo>();
  private socketInstanceContainer: AsyncContainer<WebSocket> | null = null;
  private messageHandlers = new Map<number, (e: any) => any>();
  private msgId = 0;
  private constructor() {}

  private logInfo(...content: any[]) {
    const tags = ["socket"];
    console.log(`[${tags.join("][")}]`, ...content);
  }

  private logError(...content: any[]) {
    const tags = ["socket"];
    console.error(`[${tags.join("][")}]`, ...content);
  }

  static getInstance() {
    if (this.instance === null) {
      this.instance = new SQLiteSocket();
    }
    return this.instance;
  }
  configure() {
    socketConfig
      .get()
      .then((result) => this.socketInfoContainer.resolve(result))
      .then(() => this.logInfo(`Configured`))
      .catch((e) => this.socketInfoContainer.reject(e));
  }

  private async getSocketConfig() {
    let config = this.socketInfoContainer.value;

    if (config === undefined) {
      config = await this.socketInfoContainer.promise;
    }

    const { authToken, port } = config;

    if (!authToken || !port) {
      throw new Error(`Invalid socket config`);
    }
    return config;
  }

  private async getSocket(): Promise<WebSocket> {
    const { port } = await this.getSocketConfig();

    if (this.socketInstanceContainer === null) {
      this.socketInstanceContainer = new AsyncContainer();
      const url = `ws://127.0.0.1:${port}`;
      this.logInfo(`Create socket to ${url}`);
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        this.socketInstanceContainer.resolve(socket);
      };
      socket.onerror = (e) => {
        this.logError(`Websocket error:`, e);
      };
      socket.onmessage = (e) => {
        const { data } = e;

        if (data.constructor !== ArrayBuffer) return;

        const td = new TextDecoder("utf-8");
        const arrayData = new Uint8Array(data);

        let rawString = "";
        try {
          rawString = td.decode(arrayData);
        } catch (e) {
          console.error(`Can't decode binary data`, e);
          return;
        }

        if (typeof rawString === "string") {
          const parsedData = JSON.parse(rawString);
          const { id } = parsedData;
          const messageHandler = this.messageHandlers.get(id);
          if (messageHandler) {
            messageHandler(parsedData);
          } else {
            this.logError(`Found no handler for message with id of '${id}'`);
          }
        }
      };
      return this.socketInstanceContainer.promise;
    }

    if (!this.socketInstanceContainer.value) {
      return this.socketInstanceContainer.promise;
    }
    return this.socketInstanceContainer.value;
  }

  async invoke(data: SendingSocketData) {
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
      const { authToken } = await this.getSocketConfig();
      const currentId = this.msgId++;
      const packedData: SendingSocketDataWithAuth = {
        ...data,
        params: paramsWithoutCallback,
        id: currentId,
        auth: authToken,
      };
      const socket = await this.getSocket();

      let dataLen = 0;
      let encodeData = null;
      if (packedData && packedData.constructor === Object) {
        const stringData = JSON.stringify(packedData);
        const enc = new TextEncoder();
        encodeData = enc.encode(stringData);
        dataLen = encodeData.length;
      }
      if (encodeData && dataLen > 0) {
        socket.send(encodeData.buffer);

        const messageHandler = (data: ReceivedSocketData) => {
          const { error, result } = data;
          if (callback) {
            callback(error, result);
          }
          resolve();
        };
        this.messageHandlers.set(currentId, messageHandler);
      }
    });
  }
}

const consumableSQLite3: sqlite3 = {
  // @ts-ignore
  Database,
};

export default consumableSQLite3;
