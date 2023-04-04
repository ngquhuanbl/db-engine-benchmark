import { DBEngineResult } from "./constants";
import * as IndexedDBExecutor from "../../renderer/indexedDB/actions";
import {
  DEFAULT_LIMIT,
  DEFAULT_NUM_OF_INDEXED_KEYS,
  DEFAULT_NUM_OF_RANGE,
  DEFAULT_READ_BATCH_SIZE,
  DEFAULT_READ_BY_LIMIT_COUNT,
  DEFAULT_READ_BY_NON_INDEX_COUNT,
  DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
} from "../../../constants/dataset";
import {
  DEFAULT_READ_USING_BATCH,
  DEFAULT_RELAXED_DURABILITY_MODE_ON,
} from "../../../constants/modes";
import {
  addConsoleLog,
  formatDBEngineResult,
  getIndexedKeys,
  removeConsoleLog,
  verifyDBEngineResult,
} from "./helper";
import { calculateRange } from "../calculate-range";

export const execute = async (
  datasetSize: number,
  benchmarkCount: number
): Promise<DBEngineResult> => {
  const finalResult: DBEngineResult = {
    singleWrite: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    singleRead: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    update: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    delete: {
      nTransaction: 0,
      oneTransaction: 0,
    },
  };

  //#region Single read write
  {
    const {
      nTransactionRead,
      nTransactionWrite,
      oneTransactionRead,
      oneTransactionWrite,
    } = await IndexedDBExecutor.singleReadWrite(
      benchmarkCount,
      datasetSize,
      DEFAULT_RELAXED_DURABILITY_MODE_ON,
      DEFAULT_READ_USING_BATCH,
      DEFAULT_READ_BATCH_SIZE,
      addConsoleLog,
      removeConsoleLog
    );

    finalResult["singleRead"] = {
      nTransaction: nTransactionRead,
      oneTransaction: oneTransactionRead,
    };

    finalResult["singleWrite"] = {
      nTransaction: nTransactionWrite,
      oneTransaction: oneTransactionWrite,
    };
  }
  //#endregion

  //#region Update
  {
    const { nTransaction, oneTransaction } = await IndexedDBExecutor.updateItem(
      benchmarkCount,
      datasetSize,
      DEFAULT_RELAXED_DURABILITY_MODE_ON,
      DEFAULT_READ_USING_BATCH,
      DEFAULT_READ_BATCH_SIZE,
      addConsoleLog,
      removeConsoleLog
    );

    finalResult["update"] = {
      nTransaction,
      oneTransaction,
    };
  }
  //#endregion

  //#region Delete
  {
    const { nTransaction, oneTransaction } = await IndexedDBExecutor.deleteItem(
      benchmarkCount,
      datasetSize,
      DEFAULT_RELAXED_DURABILITY_MODE_ON,
      DEFAULT_READ_USING_BATCH,
      DEFAULT_READ_BATCH_SIZE,
      addConsoleLog,
      removeConsoleLog
    );

    finalResult["delete"] = {
      nTransaction,
      oneTransaction,
    };
  }
  //#endregion

  verifyDBEngineResult(finalResult);

  return formatDBEngineResult(finalResult);
};
