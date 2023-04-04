import { execute as executeIDB } from "./idb";
import { execute as executeSQLite } from "./sqlite";

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

  const nativeSQLiteResult = await executeSQLite(datasetSize, benchmarkCount);

  window.resultHandler.write({
    datasetSize,
    benchmarkCount: benchmarkCount,
    result: {
      "native-sqlite": nativeSQLiteResult,
    },
  });
}

// @ts-ignore
window.start = start;