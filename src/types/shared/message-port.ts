import { ActionTypes } from "../../constants/action-types";
import { MessageTypes } from "../../constants/message";
import {
  ReadAllExtraData,
  ReadByIndexExtraData,
  ReadByLimitExtraData,
  ReadByRangeExtraData,
  ReadFromEndSourceExtraData,
} from "./action";
import { Data } from "./data";
import {
  ReadAllResult,
  ReadByIndexResult,
  ReadByLimitResult,
  ReadByRangeResult,
  ReadFromEndSourceResult,
  SingleReadWriteResult,
} from "./result";

interface BaseMessage {
  id: string;
  type: MessageTypes;
}

interface BasePortMessageRequest<T extends ActionTypes, D> extends BaseMessage {
  type: typeof MessageTypes.REQUEST;
  params: {
    type: T;
    data: D;
  };
}

export type AddLogMessageRequest = BasePortMessageRequest<
  ActionTypes.ADD_LOG,
  {
    content: string;
  }
>;

export type RemoveLogMessageRequest = BasePortMessageRequest<
  ActionTypes.REMOVE_LOG,
  {
    id: number;
  }
>;

export type SingleReadWriteMessageRequest = BasePortMessageRequest<
  ActionTypes.SINGLE_READ_WRITE,
  { datasetSize: number }
>;

export type ReadAllMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_ALL,
  { datasetSize: number; extraData: ReadAllExtraData }
>;

export type ReadByIndexMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_INDEX,
  { extraData: ReadByIndexExtraData }
>;

export type ReadByLimitMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_LIMIT,
  { extraData: ReadByLimitExtraData }
>;

export type ReadByRangeMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_RANGE,
  { extraData: ReadByRangeExtraData }
>;

export type ReadFromEndSourceMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_FROM_END_SOURCE,
  { datasetSize: number; extraData: ReadFromEndSourceExtraData }
>;

export type MessageRequest =
  | AddLogMessageRequest
  | RemoveLogMessageRequest
  | SingleReadWriteMessageRequest
  | ReadAllMessageRequest
  | ReadByIndexMessageRequest
  | ReadByLimitMessageRequest
  | ReadByRangeMessageRequest
  | ReadFromEndSourceMessageRequest;

interface BasePortMessageResult<Result> extends BaseMessage {
  type: typeof MessageTypes.RESPONSE;

  result?: Result;
  error?: Error;
}

export type AddLogMessageResult = BasePortMessageResult<{ id: number }>;

export type SingleReadWriteMessageResult =
  BasePortMessageResult<SingleReadWriteResult>;

export type ReadAllMessageResult = BasePortMessageResult<ReadAllResult>;

export type ReadByIndexMessageResult = BasePortMessageResult<ReadByIndexResult>;

export type ReadByLimitMessageResult = BasePortMessageResult<ReadByLimitResult>;

export type ReadByRangeMessageResult = BasePortMessageResult<ReadByRangeResult>;

export type ReadFromEndSourceMessageResult =
  BasePortMessageResult<ReadFromEndSourceResult>;

export type MessageResult =
  | AddLogMessageResult
  | SingleReadWriteMessageResult
  | ReadAllMessageResult
  | ReadByIndexMessageResult
  | ReadByLimitMessageResult
  | ReadByRangeMessageResult
  | ReadFromEndSourceMessageResult;

export type Message = MessageRequest | MessageResult;
