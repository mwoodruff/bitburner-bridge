# Bitburner Bridge

This tool will synchronize files bi-directionally between the Bitburner game and a location on your hard drive. This will allow you to use any external editor you like, while still being able to use the built in editor if that suits you in the moment.

## How it works

No data is stored between executions of the bitburner-bridge tool for simplicity, so the synchronization behaves differently when first connected than when running after that.

When first connected:

1. The game's typescript definition file is downloaded.
   - This can be disabled if you're a madman using plain javascript. Set the --defFile option to `skip`
2. Files on the disk missing from Bitburner are uploaded to Bitburner.
   - This prevents deleting local files unintentionally.
3. Files in Bitburner missing from the disk are downloaded from Bitburner.
   - This prevents deleting remote files unintentionally.
4. Files that exist in both but do not match are handled according to the --on-mismatch option value:
   - `fail`: Print an error with resolution instructions and exit. This is the default.
   - `upload`: Mismatched files are uploaded, making the disk the source of truth.
   - `download`: Mismatched files are downloaded, making Bitburner the source of truth.

At this point, all files should be in sync, and bitburner-bridge will do the following:

1. Any file added/modified in either location will be copied to the other.
2. Any file deleted in either location will cause the other to be deleted.

### ![warning](https://placehold.co/150x40/transparent/yellow.png?text=WARNING)

This behavior has been chosen to be least likely to cause data loss and should be pretty safe, though __DATA LOSS IS POSSIBLE__. Backup your files. You're using git anyway, right?

### What Files Are Synchronized?

Any file with a file extension of `.js`, `.ts`, or `.txt` that is inside the `--baseDir` directory and does not start with any of the `--ignore` strings.

## How To Install

Install like any other node module into your project:

```sh
npm install --save-dev bitburner-bridge
```

## How To Use

To simply use the default settings and get started, run the following in your project's root:

```sh
npx bitburner-bridge run
```

This will listen on the standard port of `12525` for the bitburner game. When it connects, the typescript definition file will be downloaded and written to `./types/NetscriptDefinitions.d.ts` and all files in the `./src` directory will be monitored and synchronized by polling the filesystem and game every `500`ms. Files that start with `tmp/` will not be touched.

If bitburner-bridge is running when the game is opened, the game should automatically connect. If the game is already running when bitburner-bridge is started you'll have to manually tell the game to connect. Navigate to the `Options` -> `Remote API` game menu and click the `connect` button. Make sure the port is the same as configured in bitburner-bridge.

## How To Configure

All options have a command line argument that can be used to override them. To see their usage, run:

```sh
npx bitburner-bridge
```

If you would prefer a configuration file to command line arguments, settings can be added to a `bitburner-bridge.json` file instead. These defaults will still be overridden by any passed command line options.

To easily create a configuration file, the save-config command can be used. To create the file with all default settings, run:

```
npx bitburner-bridge save-config
```

To update values in the config file either edit it directly, or run save-config with the option you wish to change:

```
npx bitburner-bridge save-config --port 22222
```

## Tips

Just some tips for new and old players alike.

### Just Use Typescript Files!

There is no need to use a tool to transpile your Typescript. Bitburner supports Typescript natively, and this tool will happily synchronize `.ts` files.

If you want to do this, but you'd like to use the `tsc` command or your editor to display errors project wide, the following `tsconfig.json` is sufficient:

```json
{
	"compilerOptions": {
		"noEmit": true,
		"target": "esnext",
		"module": "nodenext"
	},
	"include": ["types/*.d.ts", "src/**/*"]
}
```

### Skip Importing `NS` Into Every File

Along with the `tsconfig.json` above, create a file at `types/global.d.ts` with the following:

```js
import type * as bitburner from "./NetscriptDefinitions.d.ts";

export {};

declare global {
	interface NS extends bitburner.NS {}
}
```

---

Enjoy ;)
