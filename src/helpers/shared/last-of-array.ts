export function lastOfArray(array: any[]) {
	const n = array.length;
	if (n === 0) return undefined;
	return array[n - 1];
}