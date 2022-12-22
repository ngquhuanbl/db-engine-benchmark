import {
  DB_NAME,
  TABLE_NAME,
  COLUMN_LIST_INFO,
  PRIMARY_KEYS,
  INDEX_NAME,
  INDEXED_KEYS,
} from "../../constants/schema";
import { Z_OPEN_MODE } from "../../constants/sqlite";
import { escapeStr } from "../escape-str";
import { patchJSError } from "../patch-error";
import { getDBFilePath } from "./directory";
import { Database } from "./library";

export function openSQLiteDatabase() {
  return new Promise<Database>(async (resolve, reject) => {
    try {
      const fileName = await getDBFilePath(DB_NAME);

      const instance = await new Promise<Database>((resolve, reject) => {
        const res = new Database(fileName, Z_OPEN_MODE, (error: any) => {
          if (error) reject(error);
          else resolve(res);
        });
      });

      //#region Create missing table
      const tableName = escapeStr(TABLE_NAME);
      const didTableExits = await new Promise<boolean>((resolve, reject) => {
        const queryStr = `SELECT name FROM sqlite_master WHERE type="table" AND name=${tableName}`;
        instance.all(queryStr, (error, rows) => {
          if (error) reject(error);
          else resolve(rows.length === 1);
        });
      });

      if (!didTableExits) {
        await new Promise<void>((resolve, reject) => {
          const definedFieldsSql = COLUMN_LIST_INFO.map(
            ({ name, type }) => `${name} ${type}`
          );
          definedFieldsSql.push(`PRIMARY KEY (${PRIMARY_KEYS.join(",")})`);

          const defineSchemaSql = definedFieldsSql.join(",");
          const query: string = `CREATE TABLE IF NOT EXISTS ${tableName} (${defineSchemaSql})`;
          instance.run(query, (error) => (error ? reject(error) : resolve()));
        });
      }
      //#endregion

      //#region Create missing index
      const indexName = escapeStr(INDEX_NAME);
      const didIndexExits = await new Promise<boolean>((resolve, reject) => {
        const queryStr = `SELECT name FROM sqlite_master WHERE type="index" AND name=${indexName}`;
        instance.all(queryStr, (error, rows) => {
          if (error) reject(error);
          else resolve(rows.length === 1);
        });
      });

      if (!didIndexExits) {
        await new Promise<void>((resolve, reject) => {
          const definedFieldsSql = INDEXED_KEYS.join(' , ');

          const query: string = `CREATE INDEX ${indexName} ON ${tableName} (${definedFieldsSql})`;
          instance.run(query, (error) => (error ? reject(error) : resolve()));
        });
      }
      //#endregion

      // Return the connection
      resolve(instance);
    } catch (e) {
      reject(e);
    }
  });
}

export async function resetSQLiteData(conn: Database) {
  return new Promise<void>((resolve, reject) => {
    const query = `DELETE FROM ${escapeStr(TABLE_NAME)}`;
    conn.exec(query, (error) =>
      error
        ? reject(patchJSError(error, { tags: ["sqlite", "reset-data"] }))
        : resolve()
    );
  });
}
