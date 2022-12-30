export class AsyncContainer<T> {
	resolve: (value: T) => void = () => {};
	reject: (error: any) => void = () => {};

	promise: Promise<T>;
	value: T | undefined;

	constructor() {
		this.promise = new Promise<T>((rs, rj) => {
			this.resolve = (value: T) => {
				this.value = value;
				rs(value);
			};
			this.reject = rj;
		});
	}
}
