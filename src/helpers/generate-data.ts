import { faker } from "@faker-js/faker";

import { Data, MessageSrc } from "../types/data";
export function generateData(size: number): Array<Data> {
  return Array.from({ length: size }).map(() => ({
    msgId: faker.datatype.uuid(),
    cliMsgId: faker.datatype.uuid(),
    toUid: faker.datatype.uuid(),
    msgType: faker.datatype.number({ min: 1, max: 3 }),
    sendDttm: faker.datatype.datetime().toISOString(),
    isExpired: faker.datatype.boolean(),
    isExpiredAll: faker.datatype.boolean(),
    message: faker.datatype.boolean()
      ? faker.lorem.text()
      : {
          action: faker.datatype.string(),
          childnumber: faker.datatype.number(),
          description: faker.lorem.sentence(),
          hdUrl: faker.internet.url(),
          normalUrl: faker.internet.url(),
          oriUrl: faker.internet.url(),
          params: faker.datatype.string(),
          thumbUrl: faker.internet.url(),
          title: faker.datatype.string(),
          type: faker.datatype.string(),
        },
    updateMemberIds: Array.from({
      length: faker.datatype.number({ max: 10 }),
    }).map(() => faker.datatype.uuid()),
    act: faker.datatype.string(),
    action: faker.helpers.arrayElement([
      "leave",
      "remove_member",
      "add_member_summary",
    ]),
    eventInfo: {
      source: JSON.parse(faker.datatype.json()),
      updateMembers: Array.from({
        length: faker.datatype.number({ max: 10 }),
      }).map(() => faker.datatype.uuid()),
      updateInfo: JSON.parse(faker.datatype.json()),
      errorMembers: JSON.parse(faker.datatype.json()),
      fromUid: faker.datatype.uuid(),
      toUid: faker.datatype.uuid(),
      role: faker.datatype.string(3),
      actType: faker.datatype.string(3),
      ts: faker.datatype.number(3),
    },
    zglobalMsgId: faker.datatype.uuid(),
    src: faker.helpers.arrayElement(
      Object.values(MessageSrc)
    ) as unknown as MessageSrc,
    actionId: faker.datatype.uuid(),
    status: faker.datatype.number(5),
    notify: faker.datatype.uuid(),
    mentions: Array.from({ length: faker.datatype.number({ max: 10 }) }).map(
      () => JSON.parse(faker.datatype.json())
    ),
    quote: {
      quoteChatId: faker.datatype.uuid(),
      attach: faker.datatype.string(),
      ownerId: faker.datatype.uuid(),
      ts: faker.datatype.string(),
      fromD: faker.datatype.string(),
      cliMsgId: faker.datatype.json(),
      globalMsgId: faker.datatype.number(),
      msg: faker.lorem.text(),
      cliMsgType: faker.datatype.number(3),
      msgMediaRolled: faker.datatype.boolean(),
      ttl: faker.datatype.number(),
      quoteStatus: faker.datatype.string(),
      gOwnerId: faker.datatype.uuid(),
      fromUid: faker.datatype.uuid(),
      msgId: faker.datatype.uuid(),
      textParams: Array.from({
        length: faker.datatype.number({ max: 10 }),
      }).map(() => faker.datatype.string()),
      conversation: JSON.parse(faker.datatype.json()),
    },
    serverTime: faker.datatype.datetime().toISOString(),
    fromUid: faker.datatype.uuid(),
    dName: faker.lorem.words(),
    localDttm: faker.datatype.datetime().getTime(),
    ttl: faker.datatype.number(),
    st: faker.datatype.number(),
    at: faker.datatype.number(),
    cmd: faker.datatype.number(),
    originMsgType: faker.datatype.string(),
    subState: faker.datatype.number(5),
    e2eeStatus: faker.datatype.number(5),
    sequenseId: faker.datatype.number(),
    isLocalMsgId: faker.datatype.boolean(),
    properties: {
      size: faker.datatype.number(),
      ext: faker.system.fileExt(),
      type: faker.datatype.number(3),
      color: faker.datatype.number(256),
      subType: faker.datatype.number(3),
    },
    originTs: faker.datatype.string(),
    subType: faker.datatype.number(3),
    localPath: faker.system.filePath(),
    folderPath: faker.system.directoryPath(),
    root: faker.datatype.number(),
    syncFromMobile: faker.datatype.boolean(),
    topOut: faker.datatype.string(),
    topOutTimeOut: faker.datatype.datetime().toISOString(),
    topOutImprTimeOut: faker.datatype.datetime().toISOString(),
    previewThumb: faker.internet.avatar(),
    refMessageId: faker.datatype.uuid(),
    urgency: faker.datatype.number(),
    dimension: {
      width: faker.datatype.number(),
      height: faker.datatype.number(),
      type: faker.datatype.number(),
      bigRes: faker.datatype.boolean(),
      orientation: JSON.parse(faker.datatype.json()),
    },
    extra: { todoInfo: JSON.parse(faker.datatype.json()) },
    _friendRequestData: {
      msg: faker.lorem.text(),
      src: faker.datatype.number(5),
      userId: faker.datatype.uuid(),
    },
    content: faker.lorem.text(),
    isErrorInfo: faker.datatype.boolean(),
    hasReact: faker.datatype.boolean(),
    uidSenderDel: faker.datatype.uuid(),
    footer: {
      type: faker.datatype.number(5),
      title: faker.lorem.words(),
      appId: faker.datatype.number(),
      clickType: faker.datatype.number(),
      params: null,
    },
    sendErrorCode: faker.datatype.number(10),
    __isUpdateMessage: faker.datatype.boolean(),
    __updateData: {
      clientVersion: faker.datatype.number(10),
      idleUpdateInfo: JSON.parse(faker.datatype.json()),
      meta: JSON.parse(faker.datatype.json()),
      name: faker.lorem.words(),
      notes: faker.lorem.sentence(),
      notify: faker.datatype.boolean(),
      path: faker.internet.url(),
      sha2: faker.datatype.string(),
      updateType: faker.datatype.number(),
      url: faker.internet.url(),
      version: faker.datatype.string(),
      cachedPath: faker.internet.url(),
      clientOldVersion: faker.datatype.number(),
      isModuleUpdate: faker.datatype.boolean(),
      downloadedFile: faker.system.filePath(),
    },
    width: faker.datatype.number(),
    height: faker.datatype.number(),
    zipKey: faker.datatype.string(),
    resend: {
      userId: faker.datatype.uuid(),
      conversationId: faker.datatype.uuid(),
      msgId: faker.datatype.uuid(),
      isGroup: faker.datatype.boolean(),
      clientId: faker.datatype.number(),
      type: faker.datatype.number(10),
      content: JSON.parse(faker.datatype.json()),
      subType: faker.datatype.number(10),
      subState: faker.datatype.number(10),
      _isGifPhoto: faker.datatype.boolean(),
      e2eeStatus: faker.datatype.number(10),
    },
    cancelled: faker.datatype.boolean(),
    z_parsedTokens: Array.from({ length: faker.datatype.number(10) }).map(() =>
      faker.datatype.string()
    ),
    isLastMsg: faker.datatype.boolean(),
    isSelected: faker.datatype.boolean(),
    textArguments: Array.from({ length: faker.datatype.number(5) }).map(() =>
      JSON.parse(faker.datatype.json())
    ),
    msgText: faker.lorem.text(),
    actionText: faker.datatype.string(),
    platformType: faker.datatype.number(10),
    oldMsgId: faker.datatype.uuid(),
    vOrient: faker.datatype.number(),
    fileSize: faker.datatype.number(),
    upSrc: faker.datatype.number(),
    reader: faker.datatype.number(),
    sequenceId: faker.datatype.number(),
    staredDttm: faker.datatype.datetime().getTime(),
  }));
}
