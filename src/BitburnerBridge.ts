import fs from "fs";
import BitburnerServer, { type BitburnerServerEvents } from "./BitburnerServer.ts";
import type { BitburnerBridgeConfig } from "./config.ts";
import SimpleEventEmitter from "./SimpleEventEmitter.ts";
import type { BitburnerFileWatcherEvents, FileChange } from "./BitburnerFileWatcher.ts";
import BitburnerFileManager from "./BitburnerFileWatcher.ts";
import path from "path";

type BitburnerFileAction = "uploaded" | "downloaded" | "localDeleted" | "remoteDeleted";

type BitburnerBridgeEvents = BitburnerServerEvents &
	BitburnerFileWatcherEvents & {
		fileActionTaken: [filename: string, action: BitburnerFileAction];
		definitionsWritten: [filename: string];
	};

export default class BitburnerBridge extends SimpleEventEmitter<BitburnerBridgeEvents> {
	#config: BitburnerBridgeConfig;
	#server: BitburnerServer;
	#watcher: BitburnerFileManager;

	constructor(config: BitburnerBridgeConfig) {
		super();

		this.#config = config;
		this.#server = new BitburnerServer(config);
		this.#watcher = new BitburnerFileManager(this.#server, config);

		this.#watcher.on("fileChanges", this.#onFileChanges.bind(this));

		this.#server.on("error", (err) => {
			this._emit("error", err);
		});

		this.#server.on("connected", () => {
			if (this.#config.defFile.toLowerCase() !== "skip") {
				this.#writeDefinitionsFile();
			}
			this._emit("connected");
		});

		this.#server.on("disconnected", () => {
			this._emit("disconnected");
		});
	}

	async #writeDefinitionsFile() {
		const filePath = path.resolve(this.#config.defFile);
		const dirPath = path.dirname(filePath);
		const definitionFile = await this.#server.getDefinitionFile();

		await fs.promises.mkdir(dirPath, { recursive: true });
		await fs.promises.writeFile(filePath, definitionFile);

		this._emit("definitionsWritten", path.relative(process.cwd(), filePath));
	}

	async #onFileChanges(changes: FileChange[], isInitial: boolean) {
		if (isInitial && this.#config.onMismatch === "fail") {
			const updates = changes.filter((change) => change.type === "updated");

			if (updates.length > 0) {
				this._emit(
					"error",
					new Error(
						"The --on-mismatch option is set to 'fail', and there are file mismatches between local and Bitburner.\n" +
							"The following files are not the same locally and in Bitburner: \n" +
							updates.map((change) => change.file).join("\n") +
							"\n To continue, either: \n" +
							"  1. Delete one of the edited files and let bitburner-bridge download/upload the other automatically.\n" +
							"  2. Change the --on-mismatch option to 'upload' to overwrite the files in Bitburner for all mismatches.\n" +
							"  3. Change the --on-mismatch option to 'download' to overwrite the local files for all mismatches.",
					),
				);
			}
		}

		this._emit("fileChanges", changes, isInitial);

		for (const change of changes) {
			// For initial sync, an updated event is emitted for both files. This skips the one that is not the source of truth.
			if (
				isInitial &&
				change.type === "updated" &&
				((this.#config.onMismatch === "upload" && change.source === "remote") ||
					(this.#config.onMismatch === "download" && change.source === "local"))
			) {
				continue;
			}

			const localFilePath = path.resolve(this.#config.baseDir, change.file);

			if (change.type === "deleted") {
				if (change.source === "remote") {
					await fs.promises.unlink(localFilePath);
					this._emit("fileActionTaken", change.file, "localDeleted");
				} else if (change.source === "local") {
					await this.#server.deleteFile("home", change.file);
					this._emit("fileActionTaken", change.file, "remoteDeleted");
				}
			} else if (change.source === "local") {
				await this.#server.pushFile("home", change.file, change.content!);
				this._emit("fileActionTaken", change.file, "uploaded");
			} else if (change.source === "remote") {
				await fs.promises.writeFile(localFilePath, change.content!);
				this._emit("fileActionTaken", change.file, "downloaded");
			}
		}
	}
}
