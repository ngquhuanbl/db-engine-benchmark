/** Convert milisecond to second */
export function convertMsToS(ms: number) {
  if (ms < 0) return ms;
  let second = ms / 1000;
  let index = 0;
  while (second < 1) {
    second = second * 10;
    index += 1;
  }

  second = second * 10;
  index += 1;

  return Math.round(second) / Math.pow(10, index);
}
