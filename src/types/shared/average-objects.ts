export const averageOfObjects = <T extends Record<string, number>>(
  objs: T[]
): T | null => {
  const length = objs.length;
  if (length === 0) return null;

  const keys = Object.keys(objs[0]);
  const res = {};
  for (const obj of objs) {
    for (const key of keys) {
      const value = obj[key];

      if (res[key] === undefined) res[key] = 0;

      res[key] += value;
    }
  }

  for (const key of keys) {
    const sum = res[key];
    res[key] = sum / length;
  }

  return res as any;
};
const sleep = (ms: number) => new Promise((rs) => setTimeout(rs, ms))

export const averageFnResults = <P extends any[], R extends any>(
  count: number,
  fn: (...args: P) => R
) => {
  return async (...args: P) => {
    const resultList = [];
    for (let i = 0; i < count; i += 1) {
      try {
        const result = await fn(...args);
		await sleep(500);
        resultList.push(result);
      } catch (e) {
        debugger;
        console.log(e);
        throw e;
      }
    }
	
    const averageResult = averageOfObjects(resultList);
    return averageResult as R;
  };
};
