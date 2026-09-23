import * as LogLevel from "effect/LogLevel";

import { isPackagedElectronApp } from "@frt/api/helpers/is-packaged-electron-app.ts";

const LOG_LEVEL_ARGUMENT_PREFIX = "--log-level=";

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
