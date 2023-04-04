export const TCN_UPDATE = "update" as const;
export const TCN_DELETE = "delete" as const;

export type TestCaseName =
  | typeof TCN_UPDATE
  | typeof TCN_DELETE;

export const TEST_CASE_NAMES: TestCaseName[] = [
  "update",
  "delete",
];

export const DBE_IDB = "idb" as const;
export const DBE_NATIVE_SQLITE = "native_sqlite" as const;


type DBEngineName =
  | typeof DBE_IDB
  | typeof DBE_NATIVE_SQLITE;

export type DBEngineResult = Record<
  TestCaseName,
  {
    nTransaction?: number;
    oneTransaction?: number;
  }
>;

export type FullResult = Record<DBEngineName, DBEngineResult>;