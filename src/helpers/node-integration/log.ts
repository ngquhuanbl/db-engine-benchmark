import { ActionTypes } from "../../constants/action-types";
import { MessageTypes } from "../../constants/message";
import {
  AddLogMessageRequest,
  AddLogMessageResult,
  Message,
  RemoveLogMessageRequest,
} from "../../types/shared/message-port";
import { getPortMessageId } from "../shared/message-port";

export function addLog(content: string): Promise<number> {
  const id = getPortMessageId();
  const message: AddLogMessageRequest = {
    id,
    type: MessageTypes.REQUEST,
    params: {
      type: ActionTypes.ADD_LOG,
      data: {
        content,
      },
    },
  };
  messageBroker.sendMessage(message);
  return new Promise<number>((resolve, reject) => {
    const listener = (_: any, message: Message) => {
      const { id: receivedMessageId, type: msgType } = message;
      if (msgType !== MessageTypes.RESPONSE) return;
      if (receivedMessageId !== id) return;

      const {
        type: actionType,
        result,
        error,
      } = message as AddLogMessageResult;

      if (error) {
        reject(error);
      } else {
        const { id: logId } = result;
        resolve(logId);
      }
      messageBroker.removeMessageListener(listener);
    };
    messageBroker.addMessageListener(listener);
  });
}

export function removeLog(logId: number) {
  const msgId = getPortMessageId();
  const message: RemoveLogMessageRequest = {
    id: msgId,
    type: MessageTypes.REQUEST,
    params: {
      type: ActionTypes.REMOVE_LOG,
      data: {
        id: logId,
      },
    },
  };
  messageBroker.sendMessage(message);
}
