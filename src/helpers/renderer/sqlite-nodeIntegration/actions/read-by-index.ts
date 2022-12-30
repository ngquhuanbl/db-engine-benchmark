import { ActionTypes } from "../../../../constants/action-types";
import { ReadByIndexExtraData } from "../../../../types/shared/action";
import { ReadByIndexResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  { keys }: ReadByIndexExtraData = { keys: [] }
): Promise<ReadByIndexResult> => {
  return invokeMessage<ReadByIndexResult>({
    type: ActionTypes.READ_BY_INDEX,
    data: {
      extraData: { keys },
    },
  });
};
