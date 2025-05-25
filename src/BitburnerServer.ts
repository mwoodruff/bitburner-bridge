import { WebSocket, WebSocketServer } from "ws";
import SimpleEventEmitter from "./SimpleEventEmitter.ts";

export interface BitburnerServerEvents {
	connected: [];
	disconnected: [];
	error: [err: Error];
}

export default class BitburnerServer extends SimpleEventEmitter<BitburnerServerEvents> {
	#lastMessageId: number;

	#wss: WebSocketServer;
	#ws: WebSocket | null = null;

	get isConnected(): boolean {
		return this.#ws !== null;
	}

	constructor(opt: { port: number }) {
		super();

		this.#lastMessageId = 0;
		this.#wss = new WebSocketServer({ port: opt.port });

		this.#wss.on("connection", this.#onWssConnection.bind(this));
	}

	async pushFile(server: string, filename: string, content: string): Promise<void> {
		await this.#jsonrpc("pushFile", { server, filename, content });
	}

	async getFile(server: string, filename: string): Promise<string> {
		return (await this.#jsonrpc("getFile", { server, filename })) as string;
	}

	async deleteFile(server: string, filename: string): Promise<void> {
		await this.#jsonrpc("deleteFile", { server, filename });
	}

	async getFileNames(server: string): Promise<string[]> {
		return (await this.#jsonrpc("getFileNames", { server })) as string[];
	}

	async getAllFiles(server: string): Promise<{ filename: string; content: string }[]> {
		return (await this.#jsonrpc("getAllFiles", { server })) as { filename: string; content: string }[];
	}

	async calculateRam(server: string, filename: string): Promise<number> {
		return (await this.#jsonrpc("calculateRam", { server, filename })) as number;
	}

	async getDefinitionFile(): Promise<string> {
		return (await this.#jsonrpc("getDefinitionFile", {})) as string;
	}

	#onWssConnection(ws: WebSocket): void {
		if (this.#ws) {
			throw new Error("Already connected to Bitburner. Multiple connections are not possible.");
		}

		this.#ws = ws;

		this._emit("connected");

		ws.on("close", () => {
			this.#ws = null;
			this._emit("disconnected");
		});

		ws.on("error", (err) => {
			this._emit("error", err);
		});
	}

	async #jsonrpc(method: string, params: object): Promise<unknown> {
		if (!this.#ws) {
			throw new Error("Not connected to Bitburner");
		}

		const id = this.#lastMessageId++;

		this.#ws.send(
			JSON.stringify({
				jsonrpc: "2.0",
				id,
				method,
				params,
			}),
		);

		return new Promise((resolve, reject) => {
			const handler = (data: string) => {
				const response = JSON.parse(data);

				if (response.id != id) {
					return;
				}

				if (this.#ws !== null) {
					this.#ws.off("message", handler);
				}

				if (response.error) {
					reject(new Error(response.error.message));
				} else {
					resolve(response.result);
				}
			};

			if (this.#ws !== null) {
				this.#ws.on("message", handler);
			}
		});
	}
}
