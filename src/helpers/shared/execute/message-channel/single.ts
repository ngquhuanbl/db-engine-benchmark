import { DBEngineResult } from "../constants";
import * as MsgChannelExecutor from "../../../renderer/msg-channel/actions";
import {
  DEFAULT_LIMIT,
  DEFAULT_NUM_OF_INDEXED_KEYS,
  DEFAULT_NUM_OF_RANGE,
  DEFAULT_READ_BATCH_SIZE,
  DEFAULT_READ_BY_LIMIT_COUNT,
  DEFAULT_READ_BY_NON_INDEX_COUNT,
  DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
} from "../../../../constants/dataset";
import {
  DEFAULT_READ_USING_BATCH,
} from "../../../../constants/modes";
import {
  addConsoleLog,
  formatDBEngineResult,
  getIndexedKeys,
  removeConsoleLog,
  verifyDBEngineResult,
} from "../helper";
import { calculateRange } from "../../calculate-range";

export const execute = async (
  datasetSize: number,
  benchmarkCount: number
): Promise<DBEngineResult> => {
  window.PARTITION_MODE = true;
  const finalResult: DBEngineResult = {
    singleWrite: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    singleRead: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    readByRange: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    readAll: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    readFromEndSource: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    readByIndex: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    readByLimit: {
      nTransaction: 0,
      oneTransaction: 0,
    },
    readByNonIndex: {
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
    } = await MsgChannelExecutor.singleReadWrite(
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

  //#region Read by range
  {
    const { nTransactionSum, oneTransactionSum } =
      await MsgChannelExecutor.readByRange(
        benchmarkCount,
        DEFAULT_READ_USING_BATCH,
        DEFAULT_READ_BATCH_SIZE,
        addConsoleLog,
        removeConsoleLog,
        {
          ranges: calculateRange(datasetSize, DEFAULT_NUM_OF_RANGE),
        }
      );

    finalResult["readByRange"] = {
      nTransaction: nTransactionSum,
      oneTransaction: oneTransactionSum,
    };
  }
  //#endregion

  //#region Read all
  {
    const { nTransactionSum, oneTransactionSum } =
      await MsgChannelExecutor.readAll(
        benchmarkCount,
        datasetSize,
        DEFAULT_READ_USING_BATCH,
        DEFAULT_READ_BATCH_SIZE,
        addConsoleLog,
        removeConsoleLog
      );

    finalResult["readAll"] = {
      nTransaction: nTransactionSum,
      oneTransaction: oneTransactionSum,
    };
  }
  //#endregion

  //#region Read from end source
  {
    const { nTransactionSum, oneTransactionSum } =
      await MsgChannelExecutor.readFromEndSource(
        benchmarkCount,
        datasetSize,
        DEFAULT_READ_USING_BATCH,
        DEFAULT_READ_BATCH_SIZE,
        addConsoleLog,
        removeConsoleLog,
        {
          readFromEndSourceCount:
            DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
        }
      );

    finalResult["readFromEndSource"] = {
      nTransaction: nTransactionSum,
      oneTransaction: oneTransactionSum,
    };
  }
  //#endregion

  //#region Read by index
  {
    const { nTransactionSum, oneTransactionSum } =
      await MsgChannelExecutor.readByIndex(
        benchmarkCount,
        DEFAULT_READ_USING_BATCH,
        DEFAULT_READ_BATCH_SIZE,
        addConsoleLog,
        removeConsoleLog,
        {
          keys: getIndexedKeys(DEFAULT_NUM_OF_INDEXED_KEYS),
        }
      );

    finalResult["readByIndex"] = {
      nTransaction: nTransactionSum,
      oneTransaction: oneTransactionSum,
    };
  }
  //#endregion

  //#region Read by limit
  {
    const { nTransactionSum, oneTransactionSum } =
      await MsgChannelExecutor.readByLimit(
        benchmarkCount,
        DEFAULT_READ_USING_BATCH,
        DEFAULT_READ_BATCH_SIZE,
        addConsoleLog,
        removeConsoleLog,
        {
          limit: DEFAULT_LIMIT,
          count: DEFAULT_READ_BY_LIMIT_COUNT,
        }
      );

    finalResult["readByLimit"] = {
      nTransaction: nTransactionSum,
      oneTransaction: oneTransactionSum,
    };
  }
  //#endregion

  //#region Read by non-index
  {
    const { nTransactionSum, oneTransactionSum } =
      await MsgChannelExecutor.readByNonIndex(
        benchmarkCount,
        DEFAULT_READ_USING_BATCH,
        DEFAULT_READ_BATCH_SIZE,
        addConsoleLog,
        removeConsoleLog,
        {
          count: DEFAULT_READ_BY_NON_INDEX_COUNT,
        }
      );

    finalResult["readByNonIndex"] = {
      nTransaction: nTransactionSum,
      oneTransaction: oneTransactionSum,
    };
  }

  verifyDBEngineResult(finalResult);

  return formatDBEngineResult(finalResult);
};
