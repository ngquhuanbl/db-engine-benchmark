import { FullResult } from "./constants";
import { execute as executeIDB } from "./idb";
import { execute as executeSinglePreload } from "./preload/single";
import { execute as executeCrossPreload } from "./preload/cross";
import { execute as executeSingleWebsocket } from "./web-socket/single";
import { execute as executeCrossWebsocket } from "./web-socket/cross";
import { execute as executeSingleMsgChannel } from "./message-channel/single";
import { execute as executeCrossMsgChannel } from "./message-channel/cross";

export async function start(
  datasetSize: number,
  benchmarkCount: number
): Promise<void> {
  const idbResult = await executeIDB(datasetSize, benchmarkCount);

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      idb: idbResult,
    },
  });

  const singlePreloadResult = await executeSinglePreload(
    datasetSize,
    benchmarkCount
  );

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "preload-single": singlePreloadResult,
    },
  });

  const crossPreloadResult = await executeCrossPreload(
    datasetSize,
    benchmarkCount
  );

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "preload-cross": crossPreloadResult,
    },
  });

  const singleWebsocketResult = await executeSingleWebsocket(
    datasetSize,
    benchmarkCount
  );

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "socket-single": singleWebsocketResult,
    },
  });

  const crossWebsocketResult = await executeCrossWebsocket(
    datasetSize,
    benchmarkCount
  );

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "socket-cross": crossWebsocketResult,
    },
  });

  const singleMsgChannelResult = await executeSingleMsgChannel(
    datasetSize,
    benchmarkCount
  );

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "msg-channel-single": singleMsgChannelResult,
    },
  });

  const crossMsgChannelResult = await executeCrossMsgChannel(
    datasetSize,
    benchmarkCount
  );

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "msg-channel-cross": crossMsgChannelResult,
    },
  });
}

// @ts-ignore
window.start = start;
