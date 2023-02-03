import sqlite3 from "sqlite3";
import {
  COLUMN_LIST_INFO,
  DB_NAME,
  INDEXED_KEYS,
  INDEX_NAME,
  PRIMARY_KEYS,
  TABLE_NAME,
} from "../../../constants/schema";
import { NUM_READ, Z_OPEN_MODE } from "../../../constants/sqlite";
import { getDBFilePath } from "../../shared/directory";
import { escapeStr } from "../../shared/escape-str";
import { patchJSError } from "../../shared/patch-error";
import { ConnectionPool } from "./connection-pool";

let idCounter = 0;
class Database {
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

export class DAL {
  private static instance: DAL | null = null;
  private cachedConnections = new Map<string, Database>();
  private constructor() {}

  static getInstance(): DAL {
    if (this.instance === null) {
      this.instance = new DAL();
    }
    return this.instance;
  }

  async getConnectionForConv(convId: string): Promise<Database> {
    let cachedConn = this.cachedConnections.get(convId);
    if (cachedConn === undefined) {
      return new Promise<Database>(async (resolve, reject) => {
        try {
          const fileName = await getDBFilePath(DB_NAME, convId);

          const instance = new Database(fileName);

          //#region Create missing table
          const tableName = escapeStr(TABLE_NAME);
          const didTableExits = await new Promise<boolean>(
            (resolve, reject) => {
              const queryStr = `SELECT name FROM sqlite_master WHERE type="table" AND name=${tableName}`;
              instance.all(queryStr, (error, rows) => {
                if (error) reject(error);
                else resolve(rows.length === 1);
              });
            }
          );

          if (!didTableExits) {
            await new Promise<void>((resolve, reject) => {
              const definedFieldsSql = COLUMN_LIST_INFO.map(
                ({ name, type }) => `${name} ${type}`
              );
              definedFieldsSql.push(`PRIMARY KEY (${PRIMARY_KEYS.join(",")})`);

              const defineSchemaSql = definedFieldsSql.join(",");
              const query: string = `CREATE TABLE IF NOT EXISTS ${tableName} (${defineSchemaSql})`;
              instance.run(query, (error) =>
                error ? reject(error) : resolve()
              );
            });
          }
          //#endregion

          //#region Create missing index
          const indexName = escapeStr(INDEX_NAME);
          const didIndexExits = await new Promise<boolean>(
            (resolve, reject) => {
              const queryStr = `SELECT name FROM sqlite_master WHERE type="index" AND name=${indexName}`;
              instance.all(queryStr, (error, rows) => {
                if (error) reject(error);
                else resolve(rows.length === 1);
              });
            }
          );

          if (!didIndexExits) {
            await new Promise<void>((resolve, reject) => {
              const definedFieldsSql = INDEXED_KEYS.join(" , ");

              const query: string = `CREATE INDEX ${indexName} ON ${tableName} (${definedFieldsSql})`;
              instance.run(query, (error) =>
                error ? reject(error) : resolve()
              );
            });
          }
          //#endregion

          // Return the connection
          this.cachedConnections.set(convId, instance);
          resolve(instance);
        } catch (e) {
          reject(e);
        }
      });
    }

    return cachedConn;
  }

  resetAllConvData(): Promise<void> {
    const connections = Array.from(this.cachedConnections.values());
    return Promise.all(
      connections.map(
        (conn) =>
          new Promise<void>((resolve, reject) => {
            const query = `DELETE FROM ${escapeStr(TABLE_NAME)}`;
            conn.exec(query, (error) =>
              error
                ? reject(
                    patchJSError(error, { tags: ["sqlite", "reset-data"] })
                  )
                : resolve()
            );
          })
      )
    ).then(() => {});
  }
}

const consumableSQLite3 = {
  // @ts-ignore
  Database,
};

export default consumableSQLite3;
