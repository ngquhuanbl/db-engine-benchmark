import { ActionTypes } from "../../../../constants/action-types";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  benchmarkCount: number,
  datasetSize: number,
  readUsingBatch: boolean,
  readBatchSize: number
): Promise<SingleReadWriteResult> => {
  return invokeMessage<SingleReadWriteResult>({
    type: ActionTypes.SINGLE_READ_WRITE,
    data: {
      benchmarkCount,
      datasetSize,
      readUsingBatch,
      readBatchSize,
    },
  });
};
