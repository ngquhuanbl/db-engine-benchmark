//#region 'run-all' event
type RunAllListener = () => Promise<void>;

const runAllListeners: Record<number, RunAllListener> = {};
export const listenToRunAllEvent = (
  order: number,
  listener: RunAllListener
) => {
  runAllListeners[order] = listener;
};

export const triggerRunAllEvent = async (
  onProgress: (value: number) => void
) => {
  const entries = Object.entries(runAllListeners).sort((a, b) => +a[0] - +b[0]);
  const n = entries.length;
  onProgress(0);
  for (let i = 0; i < n; i += 1) {
    const listener = entries[i][1];
    await listener();
    const progress = ((i + 1) / n) * 100;
    onProgress(progress);
  }
  onProgress(0);
};
//#endregion

//#region 'get-all' event
interface GetAllResult {
  indexedDB: object | null;
  preloadedSQLite: object | null;
  nodeIntegrationSQLite: object | null;
}
type GetAllListener = () => GetAllResult;

const getAllListeners: Record<string, GetAllListener> = {};
export const listenToGetAllEvent = (
  actionName: string,
  listener: GetAllListener
) => {
  getAllListeners[actionName] = listener;
};
export const triggerGetAllEvent = () => {
  const res: Record<string, GetAllResult> = {};
  const entries = Object.entries(getAllListeners);
  for (const [actionName, listener] of entries) {
    const current = listener();
    res[actionName] = current;
  }
  return res;
};
//#endregion
