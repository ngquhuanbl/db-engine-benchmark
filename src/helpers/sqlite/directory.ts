export function getDBFilePath(dbName: string) {
  return path
    .getUserPath()
    .then((userPath) => `${userPath}\\sqlite\\${dbName}.db`);
}
