import { ActionTypes } from "../../../../constants/action-types";
import { DEFAULT_READ_ALL_COUNT } from "../../../../constants/dataset";
import { ReadAllExtraData } from "../../../../types/shared/action";
import { ReadAllResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";
export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  { readAllCount }: ReadAllExtraData = { readAllCount: DEFAULT_READ_ALL_COUNT }
): Promise<ReadAllResult> => {
  return invokeMessage<ReadAllResult>({
    type: ActionTypes.READ_ALL,
    data: {
      benchmarkCount,
      datasetSize,
      readUsingBatch,
      readBatchSize,
      extraData: { readAllCount },
    },
  });
};
