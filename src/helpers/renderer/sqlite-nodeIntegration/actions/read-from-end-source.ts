import { ActionTypes } from "../../../../constants/action-types";
import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  return invokeMessage<ReadFromEndSourceResult>({
    type: ActionTypes.READ_FROM_END_SOURCE,
    data: {
      benchmarkCount,
      datasetSize,
      readUsingBatch,
      readBatchSize,
      extraData: { readFromEndSourceCount },
    },
  });
};
