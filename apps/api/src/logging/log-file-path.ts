// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import * as Option from "effect/Option";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

const SESSION_FILE_NAME_PREFIX = "fellowship-run-tracker-";
const LOG_FILE_EXTENSION = ".log";
const TRACE_FILE_EXTENSION = ".otlp.jsonl";

const SESSION_FILE_NAME_PATTERN =
  /^(fellowship-run-tracker-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})(\.log|\.otlp\.jsonl)$/;

type SessionFileName = {
  readonly isLog: boolean;
  readonly sessionName: string;
};

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

export function parseSessionFileName(
  fileName: string,
): Option.Option<SessionFileName> {
  const [, sessionName, extension] =
    SESSION_FILE_NAME_PATTERN.exec(fileName) ?? [];

  if (sessionName === undefined) {
    return Option.none();
  }

  return Option.some({
    isLog: extension === LOG_FILE_EXTENSION,
    sessionName,
  });
}

const SESSION_NAME = `${SESSION_FILE_NAME_PREFIX}${formatSessionTimestamp(
  // @effect-diagnostics-next-line globalDate:off
  new Date(performance.timeOrigin),
)}`;

export const SESSION_LOG_FILE_PATH = path.join(
  appPaths.logs,
  `${SESSION_NAME}${LOG_FILE_EXTENSION}`,
);

export const SESSION_TRACE_FILE_PATH = path.join(
  appPaths.logs,
  `${SESSION_NAME}${TRACE_FILE_EXTENSION}`,
);
