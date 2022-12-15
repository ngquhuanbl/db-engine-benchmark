export async function getDBFilePath(dbName: string) {
  const userPath = await path.getUserPath();
  return path.join(userPath, "sqlite", `${dbName}.db`);
}
