import { ActionTypes } from "../constants/action-types";
import { MessageTypes } from "../constants/message";
import {
  singleReadWrite,
  readAll,
  readByIndex,
  readByLimit,
  readByRange,
  readFromEndSourceCount,
  readByNonIndex,
} from "../helpers/node-integration/sqlite/actions";
import {
  ReadAllMessageResult,
  ReadByIndexMessageResult,
  ReadByLimitMessageResult,
  ReadByNonIndexMessageResult,
  ReadByRangeMessageResult,
  ReadFromEndSourceMessageResult,
  SingleReadWriteMessageResult,
} from "../types/shared/message-port";
import './global';

messageBroker.addMessageListener(function (_, request) {
  const { id: msgId, type: msgType } = request;
  if (msgType === MessageTypes.REQUEST) {
    const { type: actionType, data: dataObj } = request.params;
    switch (actionType) {
      case ActionTypes.SINGLE_READ_WRITE: {
        const { datasetSize, benchmarkCount, readUsingBatch, readBatchSize } =
          dataObj;
        singleReadWrite(
          benchmarkCount,
          datasetSize,
          readUsingBatch,
          readBatchSize
        )
          .then((result) => {
            const message: SingleReadWriteMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      case ActionTypes.READ_ALL: {
        const {
          benchmarkCount,
          datasetSize,
          readUsingBatch,
          readBatchSize,
          extraData,
        } = dataObj;
        readAll(
          benchmarkCount,
          datasetSize,
          readUsingBatch,
          readBatchSize,
          extraData
        )
          .then((result) => {
            const message: ReadAllMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      case ActionTypes.READ_BY_INDEX: {
        const { benchmarkCount, readUsingBatch, readBatchSize, extraData } =
          dataObj;
        readByIndex(benchmarkCount, readUsingBatch, readBatchSize, extraData)
          .then((result) => {
            const message: ReadByIndexMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      case ActionTypes.READ_BY_NON_INDEX: {
        const { benchmarkCount, readUsingBatch, readBatchSize, extraData } =
          dataObj;
        readByNonIndex(benchmarkCount, readUsingBatch, readBatchSize, extraData)
          .then((result) => {
            const message: ReadByNonIndexMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      case ActionTypes.READ_BY_LIMIT: {
        const { benchmarkCount, readUsingBatch, readBatchSize, extraData } =
          dataObj;
        readByLimit(benchmarkCount, readUsingBatch, readBatchSize, extraData)
          .then((result) => {
            const message: ReadByLimitMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      case ActionTypes.READ_BY_RANGE: {
        const { benchmarkCount, readUsingBatch, readBatchSize, extraData } =
          dataObj;
        readByRange(benchmarkCount, readUsingBatch, readBatchSize, extraData)
          .then((result) => {
            const message: ReadByRangeMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      case ActionTypes.READ_FROM_END_SOURCE: {
        const {
          benchmarkCount,
          datasetSize,
          readUsingBatch,
          readBatchSize,
          extraData,
        } = dataObj;
        readFromEndSourceCount(
          benchmarkCount,
          datasetSize,
          readUsingBatch,
          readBatchSize,
          extraData
        )
          .then((result) => {
            const message: ReadFromEndSourceMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result,
            };
            messageBroker.sendMessage(message);
          })
          .catch((error) =>
            messageBroker.sendMessage({
              id: msgId,
              type: MessageTypes.RESPONSE,
              error,
            })
          );
        break;
      }
      default:
    }
  }
});
