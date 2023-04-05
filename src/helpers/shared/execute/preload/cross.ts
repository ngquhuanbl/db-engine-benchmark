import { DBEngineResult } from "../constants";
import * as PreloadDBExecutor from "../../../renderer/preload/actions";
import { DEFAULT_READ_BATCH_SIZE } from "../../../../constants/dataset";
import { DEFAULT_READ_USING_BATCH } from "../../../../constants/modes";
import {
  addConsoleLog,
  formatDBEngineResult,
  removeConsoleLog,
  verifyDBEngineResult,
} from "../helper";

export const execute = async (
  datasetSize: number,
  benchmarkCount: number
): Promise<DBEngineResult> => {
  window.PARTITION_MODE = false;
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
    } = await PreloadDBExecutor.singleReadWrite(
      benchmarkCount,
      datasetSize,
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
    const { nTransaction, oneTransaction } = await PreloadDBExecutor.updateItem(
      benchmarkCount,
      datasetSize,
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
    const { nTransaction, oneTransaction } = await PreloadDBExecutor.deleteItem(
      benchmarkCount,
      datasetSize,
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