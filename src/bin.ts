#!/usr/bin/env node

import { Command, Option } from "commander";
import { readConfig, name, version, writeConfig, type BitburnerBridgeConfig } from "./config.ts";
import { emitKeypressEvents } from "readline";
import BitburnerBridge from "./BitburnerBridge.ts";
import chalk from "chalk";

const config = readConfig();
const program = new Command();

program
	.name(name)
	.version(version)
	.description("Synchronize files with the Bitburner game server.")
	.option("--port <port>", "Port to listen for Bitburner on.", (v) => parseInt(v), config.port)
	.option("--baseDir <baseDir>", "The local directory to synchronize files from.", config.baseDir)
	.option(
		"--defFile <defFile>",
		"The definition file to write to. Set to 'skip' to skip writing the file.",
		config.defFile,
	)
	.option(
		"--pollDelayMs <pollDelayMs>",
		"The delay in milliseconds between polling for file changes.",
		parseInt,
		config.pollDelayMs,
	)
	.option(
		"--ignore <ignore...>",
		"Local and remote files or directories that start with these will not be synced.",
		config.ignore,
	)
	.addOption(
		new Option("--on-mismatch <onMismatch>", "Action to take on file mismatch on first connection.")
			.choices(["upload", "download", "fail"])
			.default(config.onMismatch),
	);

program
	.command("run")
	.description("Run the Bitburner Bridge server and begin synchronizing files.")
	.action(() => {
		run(program.opts());
	});

program
	.command("save-config")
	.description(
		`Write the combined default and provided command line options to the ${name}.json configuration file. These will be used as defaults for future runs.`,
	)
	.action(() => {
		writeConfig(program.opts());
	});

program.parse();

export function run(config: BitburnerBridgeConfig) {
	emitKeypressEvents(process.stdin);

	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}

	const bb = new BitburnerBridge(config);

	bb.on("error", (err) => {
		console.error(chalk.redBright("Error:", err));
		process.exit(1);
	});

	bb.on("disconnected", () => {
		console.log(chalk.redBright("Bitburner disconnected."));
		console.log(chalk.whiteBright("Waiting for Bitburner to connect..."));
	});

	bb.on("connected", () => {
		console.log(chalk.greenBright("Bitburner connected."));
	});

	bb.on("definitionsWritten", (filename) => {
		console.log(chalk.green("🢀"), chalk.gray(" definitions   "), chalk.blue.underline(filename));
	});

	bb.on("fileActionTaken", (filename, action) => {
		switch (action) {
			case "uploaded":
				console.log(chalk.green("🢁"), chalk.gray(" upload        "), chalk.blue.underline(filename));
				break;
			case "downloaded":
				console.log(chalk.green("🢃"), chalk.gray(" download      "), chalk.blue.underline(filename));
				break;
			case "localDeleted":
				console.log(chalk.red("🢷"), chalk.gray(" delete local  "), chalk.blue.underline(filename));
				break;
			case "remoteDeleted":
				console.log(chalk.red("🢵"), chalk.gray(" delete remote "), chalk.blue.underline(filename));
				break;
		}
	});

	process.stdin.on("keypress", (_, key) => {
		if (["\x03", "\x04", "q"].includes(key.sequence)) {
			process.exit();
		}
	});

	console.log(chalk.greenBright("Press Ctrl+C or 'q' to exit."));
	console.log("");
	console.log(chalk.whiteBright("Waiting for Bitburner to connect..."));
}
