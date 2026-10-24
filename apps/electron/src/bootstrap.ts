// Must stay first: loads the dev `.env` before the imports below read it.
import "@/load-env-file.ts";

// @effect-diagnostics-next-line nodeBuiltinImport:off
import { appendFileSync, mkdirSync } from "node:fs";

import { app } from "electron";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { SESSION_LOG_FILE_PATH } from "@frt/api/logging/log-file-path.ts";

import { flushBeforeFatalExit } from "@/application/fatal-exit-flush.ts";
import { showFatalErrorDialog } from "@/application/show-fatal-error-dialog.ts";
import {
  type CrashLogLevel,
  formatCrashError,
  formatCrashLogEntry,
} from "@/crash-log-entry.ts";

/*
 * Electron main process entry point. The application is loaded with a dynamic
 * import so failures Effect's logger can't capture — the application module
 * failing to load (e.g. a dependency missing from a packaged build), or errors
 * thrown outside of any Effect program — are still written to the log file.
 *
 * Keep this module free of Effect imports so it works when those fail to load.
 */

const FATAL_EXIT_FLUSH_TIMEOUT_MILLISECONDS = 2_000;

const MAX_LOGGED_UNHANDLED_REJECTIONS = 20;

const loggedUnhandledRejections = new Set<string>();

let isExiting = false;

// Matches the shape of `formatLogEntry` entries written by `AppLoggerLayer`.
function writeLog(level: CrashLogLevel, message: string, error: unknown) {
  // @effect-diagnostics-next-line globalDate:off
  const now = new Date();

  try {
    mkdirSync(appPaths.logs, {
      recursive: true,
    });

    appendFileSync(
      SESSION_LOG_FILE_PATH,
      `${formatCrashLogEntry(level, message, error, now)}\n`,
    );
  } catch (logError) {
    // @effect-diagnostics-next-line globalConsole:off
    console.error("Failed to write to the log file.", logError);
  }
}

function exitWithFatalError(message: string, error: unknown) {
  writeLog("FATAL", message, error);

  if (isExiting) {
    return;
  }

  isExiting = true;

  void flushBeforeFatalExit(FATAL_EXIT_FLUSH_TIMEOUT_MILLISECONDS)
    .then(() => {
      return showFatalErrorDialog({
        detail: `${message}\n\n${formatCrashError(error)}`,
        title: "Fellowship Run Tracker",
      });
    })
    .finally(() => {
      app.exit(1);
    });
}

function logUnhandledRejection(reason: unknown) {
  const formattedReason = formatCrashError(reason);

  if (
    loggedUnhandledRejections.has(formattedReason) ||
    loggedUnhandledRejections.size >= MAX_LOGGED_UNHANDLED_REJECTIONS
  ) {
    return;
  }

  loggedUnhandledRejections.add(formattedReason);

  writeLog("ERROR", "[ERROR] Unhandled promise rejection.", reason);
}

process.on("uncaughtException", (error) => {
  exitWithFatalError("[FATAL] Uncaught exception in the main process.", error);
});

process.on("unhandledRejection", logUnhandledRejection);

import("./main.ts").catch((error: unknown) => {
  exitWithFatalError("[FATAL] Failed to load the application.", error);
});
