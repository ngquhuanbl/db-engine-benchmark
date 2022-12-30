export interface SingleReadWriteResult {
  nTransactionRead: number | null;
  nTransactionWrite: number | null;
  oneTransactionRead: number | null;
  oneTransactionWrite: number | null;
}

export interface ReadByRangeResult {
  nTransactionAverage: number | null;
  nTransactionSum: number | null;
  oneTransactionAverage: number | null;
  oneTransactionSum: number | null;
}

export interface ReadAllResult {
  nTransactionAverage: number | null;
  nTransactionSum: number | null;
  oneTransactionAverage: number | null;
  oneTransactionSum: number | null;
}

export interface ReadFromEndSourceResult {
  nTransactionAverage: number | null;
  nTransactionSum: number | null;
  oneTransactionAverage: number | null;
  oneTransactionSum: number | null;
}

export interface ReadByIndexResult {
  nTransactionAverage: number | null;
  nTransactionSum: number | null;
  oneTransactionAverage: number | null;
  oneTransactionSum: number | null;
}

export interface ReadByLimitResult {
  nTransactionAverage: number | null;
  nTransactionSum: number | null;
  oneTransactionAverage: number | null;
  oneTransactionSum: number | null;
}
