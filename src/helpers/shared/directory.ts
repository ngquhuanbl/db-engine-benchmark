export async function getDBFilePath(dbName: string, convId: string,) {
  const userPath = await path.getUserPath();
  return path.join(userPath, "sqlite", dbName, `${convId}.db`);
}
