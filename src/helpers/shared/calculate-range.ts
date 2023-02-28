import memoize from "fast-memoize";
import { createMsgId } from "./create-key";

interface Range {
  from: string;
  to: string;
}

function randomNumber(min: number, max: number) {
  if (max < 0) return 0;
  return Math.round(Math.random() * (max - min) + min);
}

export const calculateRange = memoize(
  (datasetSize: number, numOfRanges: number): Range[] => {
    const res: Range[] = [];
    for (let i = 0; i < numOfRanges; i += 1) {
      const from = randomNumber(0, datasetSize - 1);
      const to = randomNumber(from, datasetSize - 1);
      res.push({ from: createMsgId(from), to: createMsgId(to) });
    }
    return res;
  }
);
