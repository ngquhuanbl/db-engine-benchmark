function pragma<T>(key: string) {
  return (value: T) => `PRAGMA ${key}=${value}`;
}

export const setSqlcipherKey = pragma<string>("key");
