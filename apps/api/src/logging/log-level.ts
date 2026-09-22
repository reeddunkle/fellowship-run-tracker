import * as LogLevel from "effect/LogLevel";

import { isPackagedElectronApp } from "@frt/api/helpers/is-packaged-electron-app.ts";

const LOG_LEVEL_ARGUMENT_PREFIX = "--log-level=";

// Also accept the more common spelling of `Warn`.
const LOG_LEVEL_ALIASES: Readonly<Record<string, LogLevel.LogLevel>> = {
  warning: "Warn",
};

function parseLogLevel(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  return (
    LogLevel.values.find((logLevel) => {
      return logLevel.toLowerCase() === normalized;
    }) ?? LOG_LEVEL_ALIASES[normalized]
  );
}

function getLogLevelArgument(argv: ReadonlyArray<string>) {
  return argv
    .find((argument) => {
      return argument.startsWith(LOG_LEVEL_ARGUMENT_PREFIX);
    })
    ?.slice(LOG_LEVEL_ARGUMENT_PREFIX.length);
}

export type ResolveLogLevelOptions = {
  readonly argv: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly isPackaged: boolean;
};

/**
 * Minimum level written to the logs, in order of precedence:
 * 1. `--log-level=<level>` launch argument (works for the packaged app),
 * 2. `LOG_LEVEL` environment variable (e.g. from the dev `.env`),
 * 3. `Info` for the packaged app, `Debug` otherwise.
 *
 * Invalid values fall back to the next source rather than failing startup.
 */
export function resolveLogLevel({
  argv,
  env,
  isPackaged,
}: ResolveLogLevelOptions): LogLevel.LogLevel {
  return (
    parseLogLevel(getLogLevelArgument(argv)) ??
    parseLogLevel(env.LOG_LEVEL) ??
    (isPackaged ? "Info" : "Debug")
  );
}

export function resolveProcessLogLevel() {
  return resolveLogLevel({
    argv: process.argv,
    env: process.env,
    isPackaged: isPackagedElectronApp(),
  });
}
