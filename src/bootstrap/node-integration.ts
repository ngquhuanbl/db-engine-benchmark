import { ActionTypes } from "../constants/action-types";
import { MessageTypes } from "../constants/message";
import {
  singleReadWrite,
  readAll,
  readByIndex,
  readByLimit,
  readByRange,
  readFromEndSourceCount,
} from "../helpers/node-integration/sqlite/actions";
import {
  ReadAllMessageResult,
  ReadByIndexMessageResult,
  ReadByLimitMessageResult,
  ReadByRangeMessageResult,
  ReadFromEndSourceMessageResult,
  SingleReadWriteMessageResult,
} from "../types/shared/message-port";

messageBroker.addMessageListener(function (_, request) {
  const { id: msgId, type: msgType } = request;
  if (msgType === MessageTypes.REQUEST) {
    const { type: actionType, data: dataObj } = request.params;
    switch (actionType) {
      case ActionTypes.SINGLE_READ_WRITE: {
        const { datasetSize } = dataObj;
        singleReadWrite(datasetSize)
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
        const { datasetSize, extraData } = dataObj;
        readAll(datasetSize, extraData)
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
        const { extraData } = dataObj;
        readByIndex(extraData)
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
      case ActionTypes.READ_BY_LIMIT: {
        const { extraData } = dataObj;
        readByLimit(extraData)
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
        const { extraData } = dataObj;
        readByRange(extraData)
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
        const { datasetSize, extraData } = dataObj;
        readFromEndSourceCount(datasetSize, extraData)
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
