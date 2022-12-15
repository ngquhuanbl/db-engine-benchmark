export type VALID_SQLITE_TYPE = 'INTEGER' | 'REAL' | 'TEXT' | 'BLOB';

export type CommandData = Array<{ sql: string, params: any, callback: Function }>