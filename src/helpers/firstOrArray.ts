export const firstOrArray = (array: any[]) => {
	if (array.length === 1) return array[0];
	return array;
}