// Must stay first: loads the dev `.env` before the imports below read it.
import "@/load-env-file.ts";

// @effect-diagnostics-next-line nodeBuiltinImport:off
import { appendFileSync, mkdirSync } from "node:fs";

import { app, dialog } from "electron";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { SESSION_LOG_FILE_PATH } from "@frt/api/logging/log-file-path.ts";

/*
 * Electron main process entry point. The application is loaded with a dynamic
 * import so failures Effect's logger can't capture — the application module
 * failing to load (e.g. a dependency missing from a packaged build), or errors
 * thrown outside of any Effect program — are still written to the log file.
 *
 * Keep this module free of Effect imports so it works when those fail to load.
 */

type LogLevel = "ERROR" | "FATAL";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

// Matches the shape of `Logger.formatJson` entries written by `AppLoggerLayer`.
function writeLog(level: LogLevel, message: string, error: unknown) {
  // @effect-diagnostics-next-line globalDate:off
  const now = new Date();

  const entry = {
    annotations: {},
    fiberId: null,
    level,
    message: [
      message,
      {
        cause: formatError(error),
      },
    ],
    spans: {},
    timestamp: now.toISOString(),
  };

  try {
    mkdirSync(appPaths.logs, {
      recursive: true,
    });

    appendFileSync(SESSION_LOG_FILE_PATH, `${JSON.stringify(entry)}\n`);
  } catch (logError) {
    // @effect-diagnostics-next-line globalConsole:off
    console.error("Failed to write to the log file.", logError);
  }
}

function exitWithFatalError(message: string, error: unknown) {
  writeLog("FATAL", message, error);

  dialog.showErrorBox(
    "Fellowship Run Tracker",
    `${message}\n\n${formatError(error)}\n\nLogs: ${appPaths.logs}`,
  );

  app.exit(1);
}

process.on("uncaughtException", (error) => {
  exitWithFatalError("[FATAL] Uncaught exception in the main process.", error);
});

process.on("unhandledRejection", (reason) => {
  writeLog("ERROR", "[ERROR] Unhandled promise rejection.", reason);
});

import("./main.ts").catch((error: unknown) => {
  exitWithFatalError("[FATAL] Failed to load the application.", error);
});
