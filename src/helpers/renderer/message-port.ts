import { MessageTypes } from "../../constants/message";
import { Message, MessageRequest } from "../../types/shared/message-port";
import { getPortMessageId } from "../shared/message-port";

export function invokeMessage<Result>(
  params: MessageRequest["params"]
): Promise<Result> {
  const msgId = getPortMessageId();
  // @ts-ignore
  const message: MessageRequest = {
    id: msgId,
    type: MessageTypes.REQUEST,
    params,
  };
  return new Promise((resolve, reject) => {
    const listener = (_: any, message: Message) => {
      const { id: receivedMsgId, type: msgType } = message;
      if (receivedMsgId !== msgId) return;
      if (msgType !== MessageTypes.RESPONSE) return;
      const { error, result } = message;
      if (error) {
        reject(error);
      } else {
        resolve(result as unknown as Result);
      }
      messageBroker.removeMessageListener(listener);
    };
    messageBroker.addMessageListener(listener);
    messageBroker.sendMessage(message);
  });
}
