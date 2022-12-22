//#region 'run-all' event
type RunAllListener = () => Promise<void>;

const runAllListeners: Record<number, RunAllListener> = {};
export const listenToRunAllEvent = (
  order: number,
  listener: RunAllListener
) => {
  runAllListeners[order] = listener;
};

export const triggerRunAllEvent = async () => {
  const entries = Object.entries(runAllListeners).sort((a, b) => +a[0] - +[0]);
  for (const [_, listener] of entries) {
    await listener();
  }
};
//#endregion

//#region 'get-all' event
interface GetAllResult {
	indexedDB: object | null;
	sqlite: object | null;
}
type GetAllListener = () => GetAllResult;

const getAllListeners: Record<string, GetAllListener> = {};
export const listenToGetAllEvent = (actionName: string, listener: GetAllListener) => {
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
