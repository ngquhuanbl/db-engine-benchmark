export function checkChecksum(checksumList: number[], datasetSize: number) {
	if (datasetSize <= 3) {
		return checksumList.every((checksum) => checksum === datasetSize);
	} else {
		const checksum = checksumList.reduce((result, current) => result + current, 0);
		return checksum === datasetSize;
	}
}