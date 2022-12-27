import { ActionTypes } from "../../../../constants/action-types";
import { ReadByRangeExtraData } from "../../../../types/shared/action";
import { ReadByRangeResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  { ranges }: ReadByRangeExtraData = { ranges: [] }
): Promise<ReadByRangeResult> => {
  return invokeMessage<ReadByRangeResult>({
    params: {
      type: ActionTypes.READ_BY_RANGE,
      data: {
        extraData: { ranges },
      },
    },
  });
};
