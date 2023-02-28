import { FullResult } from "./constants";
import { execute as executeIDB } from "./idb";
import { execute as executeSinglePreload } from "./preload/single";
import { execute as executeCrossPreload } from "./preload/cross";
import { execute as executeSingleWebsocket } from "./web-socket/single";
import { execute as executeCrossWebsocket } from "./web-socket/cross";

export async function start(
  datasetSize: number,
  benchmarkCount: number
): Promise<void> {
  const idbResult = await executeIDB(datasetSize, benchmarkCount);

  const singlePreloadResult = await executeSinglePreload(
    datasetSize,
    benchmarkCount
  );

  const crossPreloadResult = await executeCrossPreload(
    datasetSize,
    benchmarkCount
  );

  const singleWebsocketResult = await executeSingleWebsocket(
    datasetSize,
    benchmarkCount
  );

  const crossWebsocketResult = await executeCrossWebsocket(
    datasetSize,
    benchmarkCount
  );

  const finalResult: FullResult = {
    idb: idbResult,
    "preload-single": singlePreloadResult,
    "preload-cross": crossPreloadResult,
    "socket-single": singleWebsocketResult,
    "socket-cross": crossWebsocketResult,
  };

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: finalResult,
  });
}

// @ts-ignore
window.start = start;
