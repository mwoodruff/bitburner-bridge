import { EventEmitter } from "events";

export default class SimpleEventEmitter<T extends Record<keyof T, unknown[]>> {
	#emitter: EventEmitter = new EventEmitter();

	on<K extends keyof T & string>(event: K, listener: (...args: T[K]) => void): this {
		this.#emitter.on(event, listener);
		return this;
	}

	once<K extends keyof T & string>(event: K, listener: (...args: T[K]) => void): this {
		this.#emitter.once(event, listener);
		return this;
	}

	off<K extends keyof T & string>(event: K, listener: (...args: T[K]) => void): this {
		this.#emitter.off(event, listener);
		return this;
	}

	protected _emit<K extends keyof T & string>(event: K, ...args: T[K]): boolean {
		return this.#emitter.emit(event, ...args);
	}
}
