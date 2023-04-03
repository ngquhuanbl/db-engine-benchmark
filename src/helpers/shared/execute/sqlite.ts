import { DBEngineResult } from "./constants";
import * as nodeIntegrationSQLite from "../../renderer/sqlite-nodeIntegration/actions";
import { DEFAULT_READ_BATCH_SIZE } from "../../../constants/dataset";
import { DEFAULT_READ_USING_BATCH } from "../../../constants/modes";
import { formatDBEngineResult, verifyDBEngineResult } from "./helper";

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
    const { nTransaction, oneTransaction } = await nodeIntegrationSQLite.update(
      benchmarkCount,
      datasetSize,
      DEFAULT_READ_USING_BATCH,
      DEFAULT_READ_BATCH_SIZE
    );

    finalResult["update"] = {
      nTransaction,
      oneTransaction,
    };
  }
  //#endregion

  //#region Delete
  {
    const { nTransaction, oneTransaction } = await nodeIntegrationSQLite.delete(
      benchmarkCount,
      datasetSize,
      DEFAULT_READ_USING_BATCH,
      DEFAULT_READ_BATCH_SIZE
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