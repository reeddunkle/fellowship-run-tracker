import { redactUserPaths } from "@frt/api/logging/redact-user-paths.ts";

export type CrashLogLevel = "ERROR" | "FATAL";

export function formatCrashError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

export function formatCrashLogEntry(
  level: CrashLogLevel,
  message: string,
  error: unknown,
  timestamp: Date,
) {
  return redactUserPaths(
    JSON.stringify({
      annotations: {},
      cause: formatCrashError(error),
      fiberId: null,
      level,
      message,
      spanId: null,
      spans: {},
      timestamp: timestamp.toISOString(),
      traceId: null,
    }),
  );
}
