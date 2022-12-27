import { ActionTypes } from "../../../../constants/action-types";
import { DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT } from "../../../../constants/dataset";
import { ReadFromEndSourceExtraData } from "../../../../types/shared/action";
import { ReadFromEndSourceResult } from "../../../../types/shared/result";
import { invokeMessage } from "../../message-port";

export const execute = async (
  datasetSize: number,
  { readFromEndSourceCount }: ReadFromEndSourceExtraData = {
    readFromEndSourceCount: DEFAULT_READ_FROM_THE_END_OF_SOURCE_DATA_COUNT,
  }
): Promise<ReadFromEndSourceResult> => {
  return invokeMessage<ReadFromEndSourceResult>({
    params: {
      type: ActionTypes.READ_FROM_END_SOURCE,
      data: {
        datasetSize,
        extraData: { readFromEndSourceCount },
      },
    },
  });
};
