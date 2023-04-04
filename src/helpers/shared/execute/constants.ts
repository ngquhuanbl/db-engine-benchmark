export const TCN_SINGLE_WRITE = "singleWrite" as const;
export const TCN_SINGLE_READ = "singleRead" as const;
export const TCN_READ_BY_RANGE = "readByRange" as const;
export const TCN_READ_ALL = "readAll" as const;
export const TCN_READ_FROM_END_SOURCE = "readFromEndSource" as const;
export const TCN_READ_BY_INDEX = "readByIndex" as const;
export const TCN_READ_BY_LIMIT = "readByLimit" as const;
export const TCN_READ_BY_NON_INDEX = "readByNonIndex" as const;
export const TCN_UPDATE = "update" as const;
export const TCN_DELETE = "delete" as const;

export type TestCaseName =
  | typeof TCN_SINGLE_WRITE
  | typeof TCN_SINGLE_READ
//   | typeof TCN_READ_BY_RANGE
//   | typeof TCN_READ_ALL
//   | typeof TCN_READ_FROM_END_SOURCE
//   | typeof TCN_READ_BY_INDEX
//   | typeof TCN_READ_BY_LIMIT
//   | typeof TCN_READ_BY_NON_INDEX
  | typeof TCN_UPDATE
  | typeof TCN_DELETE;

export const TEST_CASE_NAMES: TestCaseName[] = [
  "singleWrite",
  "singleRead",
//   "readByRange",
//   "readAll",
//   "readFromEndSource",
//   "readByIndex",
//   "readByLimit",
//   "readByNonIndex",
  "update",
  "update"
];

export const DBE_IDB = "idb" as const;
export const DBE_PRELOAD_SINGLE = "preload-single" as const;
export const DBE_PRELOAD_CROSS = "preload-cross" as const;
export const DBE_SOCKET_SINGLE = "socket-single" as const;
export const DBE_SOCKET_CROSS = "socket-cross" as const;

export const DBE_MSG_CHANNEL_SINGLE = "msg-channel-single" as const;
export const DBE_MSG_CHANNEL_CROSS = "msg-channel-cross" as const;

type DBEngineName =
  | typeof DBE_IDB
  | typeof DBE_PRELOAD_SINGLE
  | typeof DBE_PRELOAD_CROSS
  | typeof DBE_SOCKET_SINGLE
  | typeof DBE_SOCKET_CROSS
  | typeof DBE_MSG_CHANNEL_SINGLE
  | typeof DBE_MSG_CHANNEL_CROSS;

export type DBEngineResult = Record<
  TestCaseName,
  {
    nTransaction?: number;
    oneTransaction?: number;
  }
>;

export type FullResult = Record<DBEngineName, DBEngineResult>;
