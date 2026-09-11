# Fellowship Run Tracker

## First run

Once the app is running, open the **Settings** page and verify the Fellowship log directory is correct.

Also ensure **Advanced Combat Logging** is enabled in Fellowship.

## Setup

Requires:

* Node.js `26.5.1`
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

## Other useful commands

```bash
pnpm cli:dev
pnpm docs:layers
```
