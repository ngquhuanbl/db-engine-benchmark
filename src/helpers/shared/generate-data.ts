import { faker } from "@faker-js/faker";
import memoize from "fast-memoize";

import { Data, MessageSrc } from "../../types/shared/data";
import { createMsgId } from "./create-key";

export const getConvId = memoize((index: number): string => {
  return createMsgId(Math.round(Math.random() * 8));
});

export const getAllPossibleConvIds = memoize(() => {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => createMsgId(value));
});

export const getMsgStatus = memoize((index: number): number => {
  return Math.round(Math.random() * 6);
});

export const getIsErrorInfo = memoize((index: number): boolean => {
  return !!Math.round(Math.random());
});

export const getMsgDeleteInfo = memoize((datasetSize: number) => {
  const res = Array.from({ length: datasetSize }).map((_, index) => {
    const { msgId, toUid } = getData(index);
    return {
      msgId,
      toUid,
    };
  });

  // Fisher-Yates Suffle
  let currentIndex = datasetSize,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [res[currentIndex], res[randomIndex]] = [
      res[randomIndex],
      res[currentIndex],
    ];
  }

  return res;
});

export const getMsgContentForUpdate = memoize((entryIndex: number) => {
  const content = faker.lorem.paragraph();
  return content;
});

export function generateData(size: number): Array<Data> {
  let msgIdCounter = 0;
  return Array.from({ length: size }).map(() => ({
    msgId: createMsgId(msgIdCounter++),
    cliMsgId: faker.datatype.uuid(),
    toUid: getConvId(0),
    msgType: faker.datatype.number({ min: 1, max: 3 }),
    sendDttm: `${faker.datatype.datetime().getTime()}`,
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

export const getData = (index: number): Data => {
  const msgId = createMsgId(index);
  const toUid = getConvId(index);
  return {
    ...DATA_OBJECT,
    msgId,
    toUid,
    status: getMsgStatus(index),
    isErrorInfo: getIsErrorInfo(index),
  };
};

const DATA_OBJECT: Data = {
  msgId: "000000000000000000",
  cliMsgId: "857daa1b-5af5-4597-850a-5f4649a37699",
  toUid: "000000000000000006",
  msgType: 1,
  sendDttm: "2444685980195",
  isExpired: true,
  isExpiredAll: false,
  message: {
    action: ")cNGF}uvUQ",
    childnumber: 69594,
    description: "Quia quam sequi rerum totam hic iure quo cum dolores.",
    hdUrl: "http://upright-sigh.name",
    normalUrl: "http://heavenly-reach.biz",
    oriUrl: "https://ugly-communion.name",
    params: "NM/h0\\|3kM",
    thumbUrl: "https://shimmering-interior.info",
    title: 'e".M{{C3Cj',
    type: "Vbr\\eId[Um",
  },
  updateMemberIds: [
    "86442680-8a40-4efd-b43c-392b3034c459",
    "a358df59-0ce8-460a-8808-8b9b0fa7aaaa",
    "e252d3c9-a34b-4996-9d08-4d1a1410db3b",
    "cc6179a6-8596-4db7-a534-303193c46d86",
  ],
  act: '";SSqjP4!5',
  action: "remove_member",
  eventInfo: {
    source: {
      foo: "=rgoE6+PK:",
      bar: 33890,
      bike: "},S|gDUZ8y",
      a: 63331,
      b: 28377,
      name: ".sQ{hb=TGR",
      prop: 15780,
    },
    updateMembers: [
      "f49252bb-6461-4b15-9847-64b1a9602a32",
      "b4a9e815-f659-439e-9b8a-96b60769d603",
      "d8bca837-5a7d-4705-ad61-d224baa06dc4",
      "380caeea-7ad7-4c6c-856a-74b5238fb049",
      "08d5a314-3371-4955-acdd-7d5cbbf5e071",
      "35b8e1b3-ea0c-4f7a-ba31-20adeed0ae0e",
      "945cd629-2873-4b2e-94e3-248fd1452d29",
      "8710150c-9c30-4c27-8d2b-93a4adc55d0c",
    ],
    updateInfo: {
      foo: "-mIP$4r/C*",
      bar: "Bp{nSJphVv",
      bike: ":rRP*0tvrk",
      a: "Gc</piep)v",
      b: "1<FChEf*1c",
      name: ">8]AusuF:8",
      prop: "!.Qk`a!3'C",
    },
    errorMembers: {
      foo: ",tMtwlZ!Jt",
      bar: 7680,
      bike: 70311,
      a: 'TM"[kU)X*.',
      b: "/u.-7fpos<",
      name: "j)aC?fK{F(",
      prop: "'Jzqd5OCw5",
    },
    fromUid: "ba9d5af8-bfe5-41f2-b77e-b8e77c21a0b9",
    toUid: "e0006bd7-66c6-45fd-b9db-5007817be240",
    role: "AlJ",
    actType: "jA)",
    ts: 0,
  },
  zglobalMsgId: "4293259f-4545-4e81-b82d-03532a2c87de",
  src: MessageSrc.SYNC_MOBILE_DB,
  actionId: "46b37a7a-4179-45ab-b802-43ac33c54340",
  status: 2,
  notify: "768ef9dd-2af4-478c-ac08-2af74ba9d930",
  mentions: [
    {
      foo: 68159,
      bar: 82634,
      bike: 48924,
      a: "J*&aFXqck\\",
      b: "'zi`r)Ft1<",
      name: "sP@%Nm8P_s",
      prop: "fGZx)_U\\t\\",
    },
    {
      foo: 32409,
      bar: "uX|KBmXl(M",
      bike: 83019,
      a: "adj#MDfGTm",
      b: "|_B%uy9.@O",
      name: "n+vSsd&I/T",
      prop: ">RXi%,kX5-",
    },
    {
      foo: "J&^Gr4%5,3",
      bar: "7ux/C{A!O1",
      bike: 93103,
      a: 84332,
      b: 58490,
      name: 96774,
      prop: "mqR:c$bf;$",
    },
    {
      foo: 85903,
      bar: "@f8*lg4FN'",
      bike: 92816,
      a: 76425,
      b: 74875,
      name: 10249,
      prop: "hSr)N^NAI5",
    },
    {
      foo: 42850,
      bar: "LT+JQ_4@`t",
      bike: "6:TIfO^&$-",
      a: "TcEfR{6Df}",
      b: "3cOxq&XZ#2",
      name: "r%r}R-L[yX",
      prop: 18345,
    },
    {
      foo: "QW3S1k_UI|",
      bar: 57099,
      bike: "cf}}SIf6<9",
      a: 95283,
      b: 83223,
      name: 10071,
      prop: 84766,
    },
  ],
  quote: {
    quoteChatId: "db2ffa8e-ed4c-45b0-8e98-5047d9fc77ab",
    attach: "g$ub]c*MY-",
    ownerId: "e3877e24-2aca-4ab5-bd7f-4445d832405e",
    ts: "uRcB{j=#WF",
    fromD: ">Hw\\d]xOk.",
    cliMsgId:
      '{"foo":4117,"bar":36473,"bike":"G\'AIZ1K4H[","a":7413,"b":"k<(Y0|}<^C","name":"y|eV!t$e!}","prop":24648}',
    globalMsgId: 68909,
    msg: "Animi esse aliquid accusamus fugiat voluptas ut unde ratione. Assumenda molestiae quis vel molestias officiis recusandae beatae. Quas officiis pariatur quisquam tempora incidunt voluptatibus. Quibusdam non quos sunt quam vero nam vel. Rem error vel repellendus adipisci earum aliquam occaecati. Consequuntur vitae quod laborum placeat.\nMollitia necessitatibus laboriosam suscipit placeat error. Nihil excepturi fugit dolore eos aliquam animi sint. Alias ea ratione voluptatem veritatis. Magnam consectetur quisquam illum. Officia commodi debitis ad nemo accusamus voluptates amet exercitationem. Aliquid ratione harum repudiandae debitis illum.\nEsse quidem explicabo enim quod inventore. Doloremque excepturi dolore doloremque beatae maxime rem adipisci. Nemo saepe voluptatum qui facere esse. Sed numquam aliquid commodi tempore quasi. Voluptate velit nemo. Omnis quisquam et culpa laudantium consequuntur iusto.",
    cliMsgType: 1,
    msgMediaRolled: true,
    ttl: 86497,
    quoteStatus: "A/%9}=[uXA",
    gOwnerId: "83dd1036-c131-4872-b52e-9199e2e25ac5",
    fromUid: "280b0f45-036a-40fd-94c7-c44b9b5cc749",
    msgId: "68bf561d-1127-4423-a243-a672b42f52ed",
    textParams: [
      "FuLjvnAU\\S",
      "K<[$.,iXFL",
      "O>>hpHlw#T",
      "tujvyLN4(9",
      "n9#Y\\,D9Zx",
      "_z:?/ImrK3",
    ],
    conversation: {
      foo: 3001,
      bar: 51814,
      bike: 56589,
      a: 43785,
      b: 3745,
      name: 37295,
      prop: "_9Nu]rBx8B",
    },
  },
  serverTime: "2030-04-10T19:27:19.531Z",
  fromUid: "b4a65d0f-1b29-4d07-9f9c-1d18eb86b5f6",
  dName: "sunt beatae molestiae",
  localDttm: 3210317480473,
  ttl: 94075,
  st: 8421,
  at: 47413,
  cmd: 81344,
  originMsgType: "W=7tl3Q-+\\",
  subState: 3,
  e2eeStatus: 2,
  sequenseId: 53167,
  isLocalMsgId: false,
  properties: { size: 9379, ext: "xvml", type: 2, color: 239, subType: 0 },
  originTs: "}syL.VJlAj",
  subType: 3,
  localPath: "/root/calculating_wisdom_which.oxps",
  folderPath: "/bin",
  root: 76643,
  syncFromMobile: true,
  topOut: "&{l4B#Po!>",
  topOutTimeOut: "2074-10-08T09:01:21.519Z",
  topOutImprTimeOut: "2063-04-29T18:28:07.036Z",
  previewThumb:
    "https://cloudflare-ipfs.com/ipfs/Qmd3W5DuhgHirLHGVixi6V76LhCkZUz6pnFt5AJBiyvHye/avatar/1203.jpg",
  refMessageId: "d46bfd95-082a-4c8f-8ea6-2ca4b717f7e6",
  urgency: 91493,
  dimension: {
    width: 57541,
    height: 78746,
    type: 38183,
    bigRes: false,
    orientation: {
      foo: 27894,
      bar: 'RO7?n*koz"',
      bike: 4453,
      a: "\\6QX.['d@t",
      b: 70405,
      name: "B6>O#X}9D1",
      prop: 72956,
    },
  },
  extra: {
    todoInfo: {
      foo: "Y*O!T-`Cnz",
      bar: "<BsNfyVIPY",
      bike: "/d&Qbi`D:-",
      a: "P%w;Qw)xn2",
      b: 19696,
      name: "i.']p'g9$m",
      prop: 44421,
    },
  },
  _friendRequestData: {
    msg: "autem",
    src: 3,
    userId: "0051166c-237c-428c-b5d9-1128b5fc81d3",
  },
  content:
    "Beatae vitae labore a. Reprehenderit esse velit ex earum aspernatur vitae quaerat. At amet provident. Ea necessitatibus minima. Odit aut officia cum.\nFacere omnis quas neque voluptates id voluptates non. Exercitationem expedita distinctio id fuga ducimus quam laudantium. Natus exercitationem sunt quam maxime alias harum voluptatem quis ullam. Quasi reiciendis ad magni quae cum consequuntur veritatis impedit. Exercitationem numquam doloremque unde distinctio enim. Corrupti quae quibusdam eius.\nSuscipit eius facere laboriosam totam. Neque ad voluptate vel quia illum consequuntur natus iure. Voluptas voluptatem dolorem laborum ea necessitatibus. Asperiores sint in amet dignissimos possimus ad error enim corporis.",
  isErrorInfo: true,
  hasReact: true,
  uidSenderDel: "c8739f38-c3d2-4b9f-a53f-882eef3ab249",
  footer: {
    type: 3,
    title: "numquam iure magnam",
    appId: 24578,
    clickType: 42365,
    params: null,
  },
  sendErrorCode: 2,
  __isUpdateMessage: false,
  __updateData: {
    clientVersion: 2,
    idleUpdateInfo: {
      foo: "_oSJE#l?@v",
      bar: ",>q4j_d9Y7",
      bike: 16274,
      a: 67708,
      b: 59605,
      name: 84168,
      prop: 76295,
    },
    meta: {
      foo: "0j$kB0m9qb",
      bar: "4Pm,\\%\\pmv",
      bike: 12143,
      a: ",=nd(HfAK$",
      b: "l/rwbzT+1n",
      name: 84563,
      prop: 19632,
    },
    name: "quos ex ullam",
    notes: "Dolore vitae possimus ratione in.",
    notify: false,
    path: "https://weak-slaw.net",
    sha2: "{w2=B/$&gf",
    updateType: 69648,
    url: "https://elastic-publicity.net",
    version: "UTkW'v=t2,",
    cachedPath: "https://upbeat-period.org",
    clientOldVersion: 93353,
    isModuleUpdate: false,
    downloadedFile: "/dev/ouch_temporibus.sit",
  },
  width: 6822,
  height: 47639,
  zipKey: "qR2x/Ff,La",
  resend: {
    userId: "90ba90fd-b73e-4dd8-b865-f7117e87df76",
    conversationId: "37143de7-168c-4bbe-8169-15f82e44646a",
    msgId: "553c63ae-f678-46ef-bcd8-5ad9ed4da2c3",
    isGroup: false,
    clientId: 35330,
    type: 3,
    content: {
      foo: 74225,
      bar: 'e!fb(gXw-"',
      bike: 21169,
      a: "'iB+pBk`Mk",
      b: "D-j0(gdAtN",
      name: "-0NjyM#pFc",
      prop: "u^enkBiC5s",
    },
    subType: 0,
    subState: 7,
    _isGifPhoto: false,
    e2eeStatus: 8,
  },
  cancelled: true,
  z_parsedTokens: ["uQ<jG9;}!l", "9eb?2HxMRX", "<}1X,@smXU", "z?6AU5\\Sru"],
  isLastMsg: true,
  isSelected: true,
  textArguments: [
    {
      foo: "k^c|o!8fM)",
      bar: "U&(FxSZ9[[",
      bike: 'J;gi#9`"%K',
      a: "0u0-yz^V.%",
      b: 8720,
      name: "iE]q0$a2u.",
      prop: ">*`g&Rvo41",
    },
  ],
  msgText:
    "Sint alias aliquam laudantium suscipit cumque fugiat ipsum dolor. Quas porro nam et non. Corporis minima pariatur nobis commodi fuga debitis consequatur temporibus veritatis.\nEt quisquam molestiae. Ullam quasi asperiores architecto. Ad ipsa vel assumenda itaque saepe sunt pariatur. Debitis et perferendis laborum pariatur doloremque officia fugiat quidem corrupti. Atque fugit voluptas quasi reiciendis. Aut optio quidem sequi aperiam porro veniam maiores ut culpa.\nUt consequatur iure error enim reprehenderit non. Necessitatibus laborum soluta delectus eum delectus. Numquam magni porro ut dolores facilis perspiciatis aliquam.",
  actionText: "@QhKtLYwIa",
  platformType: 3,
  oldMsgId: "36a56ed6-7595-47b9-aa9c-eed5f736be37",
  vOrient: 71612,
  fileSize: 17089,
  upSrc: 67648,
  reader: 25299,
  sequenceId: 50757,
  staredDttm: 2530006903571,
};
