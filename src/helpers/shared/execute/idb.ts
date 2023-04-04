import { DBEngineResult } from "./constants";
import * as IndexedDBExecutor from "../../renderer/indexedDB/actions";
import { DEFAULT_READ_BATCH_SIZE } from "../../../constants/dataset";
import {
  DEFAULT_READ_USING_BATCH,
  DEFAULT_RELAXED_DURABILITY_MODE_ON,
} from "../../../constants/modes";
import {
  addConsoleLog,
  formatDBEngineResult,
  removeConsoleLog,
  verifyDBEngineResult,
} from "./helper";

export const execute = async (
  datasetSize: number,
  benchmarkCount: number
): Promise<DBEngineResult> => {
  const finalResult: DBEngineResult = {
    update: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    delete: {
      nTransaction: 0,
      oneTransaction: 0,
    },
  };

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