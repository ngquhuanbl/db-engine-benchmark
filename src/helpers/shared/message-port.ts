let idCounter = 1;
export const getPortMessageId = (): string => {
  return `${window.__BUNDLENAME__.value}_${idCounter++}`;
};


