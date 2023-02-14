import { IDBRange } from "../../types/shared/indexedDB";
import { createMsgId } from "./create-key";

export const verifyReadSingleItem = (
  results: string[],
  datasetSize: number
): boolean => {
  if (!VERIFY_MODE_ON) return;

  const logError = (content: string) => {
    const tags = "[verify][read-single-item]";
    console.error(tags, content);
  };

  if (results.length !== datasetSize) {
    logError(
      `In sufficient size of total entries - ${JSON.stringify({
        expectedSize: datasetSize,
        actualSize: results.length,
      })}`
    );
    return;
  }

  let i = 0;
  while (i < datasetSize) {
    const msgId = createMsgId(i);
    if (!results.includes(msgId)) {
      logError(`Missing entry with msgId of ${msgId}`);
      return;
    }
    i += 1;
  }
};

export const verifyReadAll = (
  results: Array<string[]>,
  datasetSize: number,
  count: number
): boolean => {
  if (!VERIFY_MODE_ON) return;  

  const logError = (content: string) => {
    const tags = "[verify][read-all]";
    console.error(tags, content);
  };
  if (results.length !== count) {
    logError(`The number of results doesn't match the value of 'count'`);
    return;
  }

  for (const result of results) {
    if (result.length !== datasetSize) {
      logError(`In sufficient size of total entries`);
      return;
    }

    let i = 0;
    while (i < datasetSize) {
      if (!result.includes(createMsgId(i))) {
        logError(`Missing entry with msgId of ${i}`);
        return;
      }
      i += 1;
    }
  }
};

export const verifyReadByIndexField = (
  resultLengths: Array<number>,
  indexedKeys: string[]
) => {
  if (!VERIFY_MODE_ON) return;  

  const logError = (content: string) => {
    const tags = "[verify][read-by-index]";
    console.error(tags, content);
  };

  if (resultLengths.length !== indexedKeys.length) {
    logError(`The number of results doesn't match the number of indices`);
    return;
  }

  const resultLengthsMap: Record<string, number> = {};

  const n = resultLengths.length;
  for (let i = 0; i < n; i += 1) {
    const resultLength = resultLengths[i];
    const index = indexedKeys[i];
    if (resultLengthsMap[index] === undefined) {
      resultLengthsMap[index] = resultLength;
    } else {
      const expectedResultLength = resultLengthsMap[index];
      const actualResultLength = resultLengths[i];
      if (expectedResultLength !== actualResultLength) {
        logError(`Different results for the same index of '${index}'`);
        return;
      }
    }
  }
};

export const verifyNonIndexField = (
  results: Array<{ status: number; isErrorInfo: boolean }[]>,
  count: number
) => {
  if (!VERIFY_MODE_ON) return;

  const logError = (content: string) => {
    const tags = "[verify][read-non-index]";
    console.error(tags, content);
  };

  if (results.length !== count) {
    logError(`The number of results doesn't match the value of 'count'`);
    return;
  }

  let resultLength = -1;
  const n = count;
  for (let i = 0; i < n; i += 1) {
    const result = results[i];
    if (resultLength === -1) resultLength = result.length;
    else {
      if (result.length !== resultLength) {
        logError(`Inconsistent result length for the same condition`);
        return;
      }
    }

    // Check condition
    for (const { status, isErrorInfo } of result) {
      if (status !== 2 && !isErrorInfo) {
        logError(
          `Entry doesn't match the given condition - ${JSON.stringify({
            status,
            isErrorInfo,
          })}`
        );
        return;
      }
    }
  }
};

export const verifyReadByRange = (
  results: Array<string[]>,
  ranges: IDBRange<string>[]
) => {
  if (!VERIFY_MODE_ON) return;
  
  const logError = (content: string) => {
    const tags = "[verify][read-by-range]";
    console.error(tags, content);
  };
  if (results.length !== ranges.length) {
    logError(`The number of results doesn't match the number of ranges`);
    return;
  }

  const n = results.length;
  for (let i = 0; i < n; i += 1) {
    const { from, to } = ranges[i];
    const result = results[i];
    const size = +to - +from + 1;
    if (size !== result.length) {
      logError(`Wrong result by range - ${JSON.stringify({ from, to })}`);
      return;
    }
  }
};

export const verifyReadFromEndSource = (
  results: Array<string[]>,
  datasetSize: number,
  count: number
) => {
  if (!VERIFY_MODE_ON) return;

  const logError = (content: string) => {
    const tags = "[verify][read-from-end-source]";
    console.error(tags, content);
  };

  if (results.length !== count) {
    logError(`The number of results doesn't match the value of 'count'`);
    return;
  }

  for (const result of results) {
    if (result.length !== datasetSize) {
      logError(`In sufficient size of total entries`);
      return;
    }

    let i = 0;
    while (i < datasetSize) {
      if (!result.includes(createMsgId(i))) {
        logError(`Missing entry with msgId of ${i}`);
        return;
      }
      i += 1;
    }
  }
};

export const verifyReadByLimit = (
  results: Array<string[]>,
  count: number,
  limit: number
) => {
  if (!VERIFY_MODE_ON) return;
    
  console.log({ results, limit, count })

  const logError = (content: string) => {
    const tags = "[verify][read-by-limit]";
    console.error(tags, content);
  };

  if (results.length !== count) {
    logError(`The number of results doesn't match the value of 'count'`);
    return;
  }

  for (const result of results) {
    if (result.length !== limit) {
      logError(
        `Result doesn't match the limit value - ${JSON.stringify({
          actualLength: result.length,
          limit,
        })}`
      );
      return;
    }
  }
};