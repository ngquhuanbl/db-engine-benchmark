import { MSG_ID_LENGTH } from "../constants/dataset";

export function createMsgId(value: number) {
	return `${value}`.padStart(MSG_ID_LENGTH, '0');
}