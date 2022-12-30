import sqlite3, { RunResult, Statement } from "sqlite3";
import { NUM_READ, Z_OPEN_MODE } from "../../../constants/sqlite";
import { ConnectionPool } from "./connection-pool";

let idCounter = 0;
export class Database {
  private id: number;
  private filename: string;
  private pool: ConnectionPool;

  constructor(filename: string) {
    this.id = ++idCounter;
    this.filename = filename;
    const createConnection = () =>
      new Promise<sqlite3.Database>((resolve, reject) => {
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

  serialize(callback) {
    this.pool.serialize(callback);
  }

  all(...args) {
    this.pool.all(...args);
  }
}

const consumableSQLite3 = {
  // @ts-ignore
  Database,
};

export default consumableSQLite3;
