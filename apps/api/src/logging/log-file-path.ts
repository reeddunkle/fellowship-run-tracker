// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

const LOG_FILE_NAME_PREFIX = "fellowship-run-tracker-";
const LOG_FILE_EXTENSION = ".log";

/**
 * Session files (`fellowship-run-tracker-2026-09-22T17-08-21.log`), plus the
 * earlier one-file-per-day naming (`2026-09-22-fellowship-run-tracker.log`) so
 * those age out too.
 */
const LOG_FILE_NAME_PATTERN =
  /^(?:fellowship-run-tracker-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}-fellowship-run-tracker)\.log$/;

function padTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function formatSessionTimestamp(date: Date) {
  const datePart = [
    date.getFullYear(),
    padTwoDigits(date.getMonth() + 1),
    padTwoDigits(date.getDate()),
  ].join("-");

  const timePart = [
    padTwoDigits(date.getHours()),
    padTwoDigits(date.getMinutes()),
    padTwoDigits(date.getSeconds()),
  ].join("-");

  return `${datePart}T${timePart}`;
}

export function isLogFileName(fileName: string) {
  return LOG_FILE_NAME_PATTERN.test(fileName);
}

export const SESSION_LOG_FILE_PATH = path.join(
  appPaths.logs,
  `${LOG_FILE_NAME_PREFIX}${formatSessionTimestamp(
    // @effect-diagnostics-next-line globalDate:off
    new Date(performance.timeOrigin),
  )}${LOG_FILE_EXTENSION}`,
);
