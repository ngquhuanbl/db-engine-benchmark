export async function serializePromises(promises: Array<() => Promise<any>>) {
	for (const promise of promises) {
		await promise();
	}
}