export type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

type ObjectKeys<T extends object> = `${Exclude<keyof T, symbol>}`;

export type Keys<T extends object> = Array<ObjectKeys<T>>; 