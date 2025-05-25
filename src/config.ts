import fs from "fs";
import path from "path";

export const { name, version } = JSON.parse(
	fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), {
		encoding: "utf-8",
	}),
);

const configPath = path.resolve(name + ".json");

export type BitburnerBridgeConfig = {
	port: number;
	baseDir: string;
	defFile: string;
	pollDelayMs: number;
	ignore: string[];
	onMismatch: "upload" | "download" | "fail";
};

export function readConfig(): BitburnerBridgeConfig {
	const defaults = {
		port: 12525,
		baseDir: "./src",
		defFile: "./types/NetscriptDefinitions.d.ts",
		pollDelayMs: 500,
		ignore: ["tmp/"],
		onMismatch: "fail" as "upload" | "download" | "fail",
	};

	if (fs.existsSync(configPath)) {
		const fileConfig = JSON.parse(fs.readFileSync(configPath, { encoding: "utf-8" }));

		defaults.port = fileConfig.port || defaults.port;
		defaults.baseDir = fileConfig.baseDir || defaults.baseDir;
		defaults.defFile = fileConfig.defFile || defaults.defFile;
		defaults.pollDelayMs = fileConfig.pollDelayMs || defaults.pollDelayMs;
		defaults.ignore = fileConfig.ignore || defaults.ignore;
		defaults.onMismatch = fileConfig.onMismatch || defaults.onMismatch;
	}

	return defaults;
}

export function writeConfig(config: BitburnerBridgeConfig) {
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
