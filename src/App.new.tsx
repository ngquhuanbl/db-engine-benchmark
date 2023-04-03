import React, { useEffect } from "react";
import "./bootstrap/global";
import "./helpers/shared/execute";
import { MessageTypes } from "./constants/message";
import { ActionTypes } from "./constants/action-types";
import { AddLogMessageResult } from "./types/shared/message-port";

interface Props {}

let logIdCounter = 1;

const AppNew: React.FC<Props> = (props) => {
  useEffect(() => {
    messageBroker.addMessageListener((_, request) => {
      const { id: msgId, type: msgType } = request;
      if (msgType === MessageTypes.REQUEST) {
        const { type: actionType, data } = request.params;
        switch (actionType) {
          case ActionTypes.ADD_LOG: {
            const logId = logIdCounter++;
            const { content } = data;
            console.log(content);

            const responseMessage: AddLogMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result: {
                id: logId,
              },
            };
            messageBroker.sendMessage(responseMessage);
            break;
          }
        }
      }
    });
  }, []);
  return <div></div>;
};

export default AppNew;
