import { ActionTypes } from "../../../../constants/action-types";
import { SingleReadWriteResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  datasetSize: number
): Promise<SingleReadWriteResult> => {
  return invokeMessage<SingleReadWriteResult>({
    params: {
      type: ActionTypes.SINGLE_READ_WRITE,
      data: {
        datasetSize,
      },
    },
  });
};
