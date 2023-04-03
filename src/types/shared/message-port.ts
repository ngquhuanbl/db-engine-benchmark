import { ActionTypes } from "../../constants/action-types";
import { MessageTypes } from "../../constants/message";
import {
  ReadAllExtraData,
  ReadByIndexExtraData,
  ReadByLimitExtraData,
  ReadByNonIndexExtraData,
  ReadByRangeExtraData,
  ReadFromEndSourceExtraData,
} from "./action";
import {
  ReadAllResult,
  ReadByIndexResult,
  ReadByLimitResult,
  ReadByNonIndexResult,
  ReadByRangeResult,
  ReadFromEndSourceResult,
  SingleReadWriteResult,
  UpdateResult,
  DeleteResult,
} from "./result";

interface BaseMessage {
  id: string;
  type: MessageTypes;
}

interface BasePortMessageRequest<T extends ActionTypes, D extends any>
  extends BaseMessage {
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
  {
    benchmarkCount: number;
    datasetSize: number;
    readUsingBatch: boolean;
    readBatchSize: number;
  }
>;

export type ReadAllMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_ALL,
  {
    benchmarkCount: number;
    datasetSize: number;
    readUsingBatch: boolean;
    readBatchSize: number;
    extraData: ReadAllExtraData;
  }
>;

export type ReadByIndexMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_INDEX,
  {
    benchmarkCount: number;
    readUsingBatch: boolean;
    readBatchSize: number;
    extraData: ReadByIndexExtraData;
  }
>;

export type ReadByLimitMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_LIMIT,
  {
    benchmarkCount: number;
    readUsingBatch: boolean;
    readBatchSize: number;
    extraData: ReadByLimitExtraData;
  }
>;

export type ReadByRangeMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_RANGE,
  {
    benchmarkCount: number;
    readUsingBatch: boolean;
    readBatchSize: number;
    extraData: ReadByRangeExtraData;
  }
>;

export type ReadFromEndSourceMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_FROM_END_SOURCE,
  {
    benchmarkCount: number;
    datasetSize: number;
    readUsingBatch: boolean;
    readBatchSize: number;
    extraData: ReadFromEndSourceExtraData;
  }
>;

export type ReadByNonIndexMessageRequest = BasePortMessageRequest<
  ActionTypes.READ_BY_NON_INDEX,
  {
    benchmarkCount: number;
    readUsingBatch: boolean;
    readBatchSize: number;
    extraData: ReadByNonIndexExtraData;
  }
>;

export type UpdateMessageRequest = BasePortMessageRequest<
  ActionTypes.UPDATE,
  {
    benchmarkCount: number;
    datasetSize: number;
    readUsingBatch: boolean;
    readBatchSize: number;
  }
>;

export type DeleteMessageRequest = BasePortMessageRequest<
  ActionTypes.DELETE,
  {
    benchmarkCount: number;
    datasetSize: number;
    readUsingBatch: boolean;
    readBatchSize: number;
  }
>;

export type MessageRequest =
  | AddLogMessageRequest
  | RemoveLogMessageRequest
  | SingleReadWriteMessageRequest
  | ReadAllMessageRequest
  | ReadByIndexMessageRequest
  | ReadByLimitMessageRequest
  | ReadByRangeMessageRequest
  | ReadFromEndSourceMessageRequest
  | ReadByNonIndexMessageRequest
  | UpdateMessageRequest
  | DeleteMessageRequest;

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

export type ReadByNonIndexMessageResult =
  BasePortMessageResult<ReadByNonIndexResult>;

export type UpdateMessageResult = BasePortMessageResult<UpdateResult>;

export type DeleteMessageResult = BasePortMessageResult<DeleteResult>;

export type MessageResult =
  | AddLogMessageResult
  | SingleReadWriteMessageResult
  | ReadAllMessageResult
  | ReadByIndexMessageResult
  | ReadByLimitMessageResult
  | ReadByRangeMessageResult
  | ReadFromEndSourceMessageResult
  | ReadByNonIndexMessageResult
  | UpdateMessageResult
  | DeleteMessageResult;

export type Message = MessageRequest | MessageResult;
