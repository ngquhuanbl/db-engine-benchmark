export interface SocketInfo {
  authToken: string | undefined;
  port: number | undefined;
}

type Method = "close" | "all" | "run" | "get" | "exec" | "serialize";

export interface SendingSocketData {
  filename: string;
  method: Method;
  params: any[];
}

export interface SendingSocketDataWithAuth extends SendingSocketData {
	auth: string;
	id: number;
}

export interface ReceivedSocketData {
  id: number;
  error?: Error;
  result: any;
}
