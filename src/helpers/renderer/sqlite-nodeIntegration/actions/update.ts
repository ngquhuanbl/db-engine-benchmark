import { ActionTypes } from "../../../../constants/action-types";
import { UpdateResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<UpdateResult> => {
  return invokeMessage<UpdateResult>({
    type: ActionTypes.UPDATE,
    data: {
      benchmarkCount,
      datasetSize,
      readUsingBatch,
      readBatchSize,
    },
  });
};
