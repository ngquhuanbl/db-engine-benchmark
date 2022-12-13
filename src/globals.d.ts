import { sqlite3 } from "sqlite3";

declare global {
  var sqlite3: sqlite3;
  var path: {
    getUserPath: () => Promise<string>;
  };
}
