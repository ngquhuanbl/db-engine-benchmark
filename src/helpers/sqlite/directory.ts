export function getDBFilePath(dbName: string) {
	return `${userPath}/sqlite/${dbName}.db`;
}