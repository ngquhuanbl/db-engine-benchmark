import memoize from "fast-memoize";
import { convertMsToS } from "../convert";
import { getConvId } from "../generate-data";
import { DBEngineResult, TEST_CASE_NAMES } from "./constants";

let logCount = 0;
export const addConsoleLog = (content: string): number => {
  const currentLogId = logCount++;
  console.log(`[Start][${currentLogId}]`, content);
  return currentLogId;
};

export const removeConsoleLog = (logId: number) => {
  console.log(`[Done][${logId}]`);
};

export const getIndexedKeys = memoize((numOfKeys: number) => {
  const res: string[] = [];
  for (let i = 0; i < numOfKeys; i += 1) {
    res.push(getConvId(i));
  }
  return res;
});

export const verifyDBEngineResult = (result: DBEngineResult) => {
  const testcaseNames = Object.keys(result);
  const actualLength = testcaseNames.length;
  const expectedLength = TEST_CASE_NAMES.length;
  if (actualLength !== expectedLength) {
    console.error(
      `Invalid db engine result length - Expected: ${expectedLength} - Actual: ${actualLength}`
    );
  }

  for (const key of testcaseNames) {
    const { nTransaction, oneTransaction } = result[key];
    if (!nTransaction) {
      console.error(
        `Invalid nTransaction result of '${nTransaction}' at '${key}' testcase`
      );
    }

    if (!oneTransaction) {
      console.error(
        `Invalid nTransaction result of '${oneTransaction}' at '${key}' testcase`
      );
    }
  }
};

export const formatDBEngineResult = (
  result: DBEngineResult
): DBEngineResult => {
	const formattedResult: DBEngineResult = {
		singleWrite: {
			nTransaction: 0,
			oneTransaction: 0
		},
		singleRead: {
			nTransaction: 0,
			oneTransaction: 0
		},
		readByRange: {
			nTransaction: 0,
			oneTransaction: 0
		},
		readAll: {
			nTransaction: 0,
			oneTransaction: 0
		},
		readFromEndSource: {
			nTransaction: 0,
			oneTransaction: 0
		},
		readByIndex: {
			nTransaction: 0,
			oneTransaction: 0
		},
		readByLimit: {
			nTransaction: 0,
			oneTransaction: 0
		},
		readByNonIndex: {
			nTransaction: 0,
			oneTransaction: 0
		}
	}
  const testcaseNames = Object.keys(result);
  for (const key of testcaseNames) {
    const { nTransaction, oneTransaction } = result[key];
    if (nTransaction) {
      formattedResult[key].nTransaction = convertMsToS(nTransaction)
    }

    if (oneTransaction) {
		formattedResult[key].oneTransaction = convertMsToS(oneTransaction);
    }
  }
  
  return formattedResult;
};