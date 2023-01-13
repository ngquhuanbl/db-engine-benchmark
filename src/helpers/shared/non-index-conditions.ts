import { Data } from "../../types/shared/data";

export function getNonIndexConditionForIDB() {
	return (message: Data) => {
		return message.status === 2 && message.isErrorInfo;
	}
}

export function getNonIndexConditionSQLite() {
	return `status=2 AND isErrorInfo=1`
}