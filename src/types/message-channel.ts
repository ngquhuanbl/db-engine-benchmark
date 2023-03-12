type Method = "close" | "all" | "run" | "get" | "exec" | "serialize";

export interface SendingPortData {
  filename: string;
  method: Method;
  params: any[];
}

export interface SendingPortDataWithId extends SendingPortData {
	id: number;
}

export interface ReceivedPortData {
  id: number;
  error?: Error;
  result: any;
}
