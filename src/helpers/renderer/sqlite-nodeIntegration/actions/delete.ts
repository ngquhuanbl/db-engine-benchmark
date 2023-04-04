import { ActionTypes } from "../../../../constants/action-types";
import { DeleteResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<DeleteResult> => {
  return invokeMessage<DeleteResult>({
    type: ActionTypes.DELETE,
    data: {
      benchmarkCount,
      datasetSize,
      readUsingBatch,
      readBatchSize,
    },
  });
};