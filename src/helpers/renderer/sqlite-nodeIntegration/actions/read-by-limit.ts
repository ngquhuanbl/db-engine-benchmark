import { ActionTypes } from "../../../../constants/action-types";
import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
} from "../../../../constants/dataset";
import { ReadByLimitExtraData } from "../../../../types/shared/action";
import { ReadByLimitResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  { limit, count }: ReadByLimitExtraData = {
    limit: DEFAULT_LIMIT,
    count: DEFAULT_READ_BY_LIMIT_COUNT,
  }
): Promise<ReadByLimitResult> => {
  return invokeMessage<ReadByLimitResult>({
    params: {
      type: ActionTypes.READ_BY_LIMIT,
      data: {
        extraData: { limit, count },
      },
    },
  });
};
