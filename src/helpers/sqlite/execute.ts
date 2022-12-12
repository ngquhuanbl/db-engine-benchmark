import type { sqlite3, Database } from "sqlite3";
import { DB_NAME, TABLE_NAME } from "../../constants/schema";
import { Data } from "../../types/data";
import { Result } from "../../types/result";
import { Z_OPEN_MODE } from "../../constants/sqlite";
import { getDBFilePath } from "./directory";
import { escapeStr } from "../escape-str";

export async function execute(data: Array<Data>): Promise<Result> {
  async function resetData() {}

  // Reset data
  await resetData();

  //#region n transaction
  let nTransactionRead = -1;
  let nTransactionWrite = -1;
  // WRITE

  // READ

  //#endregion

  // Reset data
  await resetData();

  //#region one transaction
  let oneTransactionRead = -1;
  let oneTransactionWrite = -1;
  // WRITE

  // READ

  //#endregion

  return {
    nTransactionRead,
    nTransactionWrite,
    oneTransactionRead,
    oneTransactionWrite,
  };
}

function openDatabase() {
  return new Promise<Database>(async (resolve, reject) => {
    try {
      const fileName = getDBFilePath(DB_NAME);
      const instance = new sqlite3.Database(
        fileName,
        Z_OPEN_MODE,
        (error: any) => error && reject(error)
      );

      // Create missing table
      const didTableExits = await new Promise<boolean>((resolve, reject) => {
        const queryStr = `SELECT name FROM sqlite_master WHERE type="table" AND name=${escapeStr(
          TABLE_NAME
        )}`;
        instance.get(queryStr, (error, row) => error ? reject(error): resolve(row));
      });

      // Return the connection
      resolve(instance);
    } catch (e) {
      reject(e);
    }
  });
}
