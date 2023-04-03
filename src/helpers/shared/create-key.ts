import memoize from "fast-memoize";
import { MSG_ID_LENGTH } from "../../constants/dataset";

export const createMsgId = memoize((value: number) => {
	return `${value}`.padStart(MSG_ID_LENGTH, '0');
})