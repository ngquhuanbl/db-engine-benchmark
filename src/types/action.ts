import { Data } from "./data";

export type Action<Result extends any> = (
  data: Array<Data>,
  addLog: (content: string) => number,
  removeLog: (id: number) => void
) => Promise<Result>;
