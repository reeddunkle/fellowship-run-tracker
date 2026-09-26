import * as Formatter from "effect/Formatter";
import * as Logger from "effect/Logger";
import type * as LogLevel from "effect/LogLevel";

import {
  type RendererLogEntry,
  type RendererLogLevel,
} from "@frt/shared/electron-renderer/renderer-log-entry-schema.ts";

const FORWARDED_LOG_LEVELS: ReadonlySet<LogLevel.LogLevel> =
  new Set<LogLevel.LogLevel>(["Warn", "Error", "Fatal"]);

function isForwardedLogLevel(
  logLevel: LogLevel.LogLevel,
): logLevel is RendererLogLevel {
  return FORWARDED_LOG_LEVELS.has(logLevel);
}

function toSerializable(value: unknown): unknown {
  return JSON.parse(Formatter.formatJson(value));
}

const ForwardToMainLogger = Logger.make((options) => {
  if (!isForwardedLogLevel(options.logLevel) || !("electronAPI" in window)) {
    return;
  }

  const { annotations, cause, message } = Logger.formatStructured.log(options);
  const [summary, ...details] = Array.isArray(message) ? message : [message];

  const entry: RendererLogEntry = {
    annotations: {
      ...annotations,
      ...(details.length === 0 ? {} : { details: toSerializable(details) }),
    },
    cause: cause ?? null,
    level: options.logLevel,
    message:
      typeof summary === "string" ? summary : Formatter.formatJson(summary),
  };

  window.electronAPI.log(entry);
});

export const RendererLoggerLayer = Logger.layer([
  Logger.consolePretty(),
  ForwardToMainLogger,
]);
