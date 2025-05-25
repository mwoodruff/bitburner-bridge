import path from "path";
import type BitburnerServer from "./BitburnerServer.ts";
import fs from "fs";
import SimpleEventEmitter from "./SimpleEventEmitter.ts";

type FileSet = Record<string, string>;

type FileSource = "local" | "remote";

type ChangeType = "added" | "updated" | "deleted";

export type FileChange = {
	file: string;
	source: FileSource;
	type: ChangeType;
	content?: string;
};

export interface BitburnerFileWatcherEvents {
	fileChanges: [changes: FileChange[], isInitial: boolean];
}

export default class BitburnerFileWatcher extends SimpleEventEmitter<BitburnerFileWatcherEvents> {
	#server: BitburnerServer;
	#ignore: string[];
	#baseDir: string;
	#pollDelayMs: number;
	#pollFilesTimeout: NodeJS.Timeout | null = null;

	#localFiles: FileSet = {};
	#remoteFiles: FileSet = {};

	#initialized = false;

	constructor(server: BitburnerServer, config: { baseDir: string; ignore: string[]; pollDelayMs: number }) {
		super();

		this.#ignore = config.ignore;
		this.#server = server;
		this.#pollDelayMs = config.pollDelayMs;
		this.#baseDir = path.resolve(config.baseDir);

		server.on("connected", this.#onServerConnected.bind(this));
		server.on("disconnected", this.#onServerDisconnected.bind(this));
	}

	async #onServerConnected() {
		this.#onPollFiles();
	}

	#onServerDisconnected() {
		if (this.#pollFilesTimeout) {
			clearTimeout(this.#pollFilesTimeout);
			this.#pollFilesTimeout = null;
		}
		this.#initialized = false;
		this.#localFiles = {};
		this.#remoteFiles = {};
	}

	async #onPollFiles() {
		const localFiles = await this.#getLocalFiles();
		const remoteFiles = await this.#getRemoteFiles();

		if (!this.#initialized) {
			const initialChanges = this.#calcInitialChanges(localFiles, remoteFiles);

			this._emit("fileChanges", initialChanges, !this.#initialized);
			this.#initialized = true;
		} else {
			const localChanges = this.#calcChanges("local", this.#localFiles, localFiles).filter(
				(c) => c.content !== remoteFiles[c.file],
			);
			const remoteChanges = this.#calcChanges("remote", this.#remoteFiles, remoteFiles).filter(
				(c) => c.content !== localFiles[c.file],
			);

			this._emit("fileChanges", [...localChanges, ...remoteChanges], !this.#initialized);
		}

		this.#localFiles = localFiles;
		this.#remoteFiles = remoteFiles;

		this.#pollFilesTimeout = setTimeout(this.#onPollFiles.bind(this), this.#pollDelayMs);
	}

	#isIgnoredFile(relativePath: string): boolean {
		if (!relativePath.match(/\.(js|ts|txt)$/)) {
			return true;
		}

		return this.#ignore.some((pattern) => relativePath.startsWith(pattern));
	}

	async #getLocalFiles(): Promise<Record<string, string>> {
		const baseDir = this.#baseDir;
		const files: FileSet = {};

		const entries = await fs.promises.readdir(baseDir, { recursive: true, withFileTypes: true });

		const fileReads: Record<string, Promise<string>> = {};

		for (const entry of entries) {
			const fullPath = path.join(entry.parentPath, entry.name);
			const relativePath = path.relative(path.resolve(baseDir), fullPath);

			if (entry.isFile() && !this.#isIgnoredFile(relativePath)) {
				fileReads[relativePath] = fs.promises.readFile(fullPath, "utf-8");
			}
		}

		for (const [relativePath, readPromise] of Object.entries(fileReads)) {
			const contents = await readPromise;
			files[relativePath] = contents;
		}

		return files;
	}

	async #getRemoteFiles(): Promise<Record<string, string>> {
		const fileArray = await this.#server.getAllFiles("home");
		const files: FileSet = {};

		for (const { filename, content } of fileArray) {
			if (this.#isIgnoredFile(filename)) {
				continue;
			}

			files[filename] = content;
		}

		return files;
	}

	#calcInitialChanges(local: FileSet, remote: FileSet): FileChange[] {
		const changes: FileChange[] = [];

		for (const [file, content] of Object.entries(local)) {
			if (remote[file] === undefined) {
				changes.push({ file, source: "local", type: "added", content });
			} else if (remote[file] !== content) {
				changes.push({ file, source: "local", type: "updated", content });
			}
		}

		for (const [file, content] of Object.entries(remote)) {
			if (local[file] === undefined) {
				changes.push({ file, source: "remote", type: "added", content });
			} else if (local[file] !== content) {
				changes.push({ file, source: "remote", type: "updated", content });
			}
		}

		return changes;
	}

	#calcChanges(source: FileSource, prevFiles: FileSet, newFiles: FileSet): FileChange[] {
		const changes: FileChange[] = [];

		for (const [file, content] of Object.entries(newFiles)) {
			if (prevFiles[file] === undefined) {
				changes.push({ file, source, type: "added", content });
			} else if (prevFiles[file] !== content) {
				changes.push({ file, source, type: "updated", content });
			}
		}

		for (const [file] of Object.entries(prevFiles)) {
			if (newFiles[file] === undefined) {
				changes.push({ file, source, type: "deleted" });
			}
		}

		return changes;
	}
}
