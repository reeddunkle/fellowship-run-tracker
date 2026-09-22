# Fellowship Run Tracker

## First run

Once the app is running, open the **Settings** page and verify the Fellowship log directory is correct.

Also ensure **Advanced Combat Logging** is enabled in Fellowship.

## Setup

Requires:

* Node.js `24.20.0` (matches the Node version bundled with Electron)
* `pnpm` `12.4.1`

Install `pnpm` if needed: https://pnpm.io/installation

Install dependencies:

```bash
pnpm install
```

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

## Development

Start the Electron app:

```bash
pnpm dev
```

The first run will download the Electron binary.

## Checks

Run all project checks:

```bash
pnpm check
```

Or run them individually:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm knip
```

## Build

Build the Electron app:

```bash
pnpm build
```

Run the built app:

```bash
pnpm start
```

### Where the app stores its files

`apps/api/src/helpers/app-paths.ts` is the single source of truth for every file the app stores on disk. Everything lives in its own subdirectory (`database/`, `security/`, `app-state/`, `logs/`, `electron/`) of `getAppDataDirectory()`:

* **Packaged app:** `%LOCALAPPDATA%\fellowship-run-tracker\Data`. It never reads a `.env`.
* **Unpackaged runs** (`pnpm dev`, `pnpm start`, the CLIs, tests): the gitignored `data/` directory at the workspace root. Delete it with `pnpm clean:data`.

Add a new kind of on-disk state to `app-paths.ts`, not as an inline path elsewhere. The workspace `.env` is development-only; its settings override built-in defaults, and relative paths in it (e.g. `DATABASE_FILENAME`) resolve against the workspace root.

### Logs

Each launch writes one JSON-lines file to `logs/`, named by launch time (e.g. `fellowship-run-tracker-2026-09-22T17-08-21.log`, local time). Old files are cleaned up at startup: after 30 days, or 90 days if the session logged a warning or error, keeping at most 200 files.

The packaged app writes Info and above. For troubleshooting, launch it with `--log-level=debug`. Development writes Debug by default (override with `LOG_LEVEL` in `.env`).

## CLI

`apps/cli` is a developer CLI (it isn't shipped with the app). List its commands, or get help for one:

```bash
pnpm cli --help
pnpm cli replay-log --help
```

Commands include `serve` (run the API without Electron), `setup-database`, `replay-log`, `filter-log`, `split-log`, `generate-lss`, `generate-unit-catalog`, and `capture-fellowship-logs-report`.

## Other useful commands

```bash
pnpm docs:layers
```

## Manual testing

Use the replay CLI to simulate a real Fellowship log file without running a dungeon.

Example:

```bash
pnpm test:replay-log-file --input "./test-logs/everdawn-grove-64-timed.txt" --output "./test-combat-logs/CombatLogReplay.txt" --speed 65
```

* `--input` — Existing Fellowship log file to replay.
* `--output` — Destination for the replayed log. This can be the real Fellowship log directory or a temporary directory. If using another directory, point the app's setting to it.
* `--speed` — Replay speed multiplier.
* `--max-delay` — Maximum delay, in milliseconds, between replayed log lines.
