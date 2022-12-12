export function escapeStr(value: any) {
	if (!value) return 'NULL';
	if (typeof value === 'string') {
		return `"${value}"`;
	}
	return value;
}