import { ActionTypes } from "../../../../constants/action-types";
import { ReadByNonIndexExtraData } from "../../../../types/shared/action";
import { ReadByNonIndexResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  benchmarkCount: number,
  readUsingBatch: boolean,
  readBatchSize: number,
  { count }: ReadByNonIndexExtraData = { count: 1 }
): Promise<ReadByNonIndexResult> => {
  return invokeMessage<ReadByNonIndexResult>({
    type: ActionTypes.READ_BY_NON_INDEX,
    data: {
      benchmarkCount,
      readUsingBatch,
      readBatchSize,
      extraData: { count },
    },
  });
};
