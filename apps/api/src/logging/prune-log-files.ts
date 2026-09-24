import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { isLogFileName } from "@frt/api/logging/log-file-path.ts";

const CLEAN_SESSION_RETENTION_DAYS = 30;

const PROBLEM_SESSION_RETENTION_DAYS = 90;

const MAX_LOG_FILES = 200;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const PROBLEM_LEVEL_MARKERS = [
  '"level":"WARN"',
  '"level":"ERROR"',
  '"level":"FATAL"',
];

const FILE_OPERATION_CONCURRENCY = 8;

type LogFile = {
  readonly ageDays: number;
  readonly modifiedAtEpochMilliseconds: number;
  readonly path: string;
};

export type PruneLogFilesOptions = {
  readonly currentLogFilePath: string;
  readonly directory: string;
};

export const pruneLogFiles = E.fn("pruneLogFiles")(function* ({
  currentLogFilePath,
  directory,
}: PruneLogFilesOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const nowEpochMilliseconds = DateTime.toEpochMillis(yield* DateTime.now);

  const directoryExists = yield* fileSystem.exists(directory);

  if (!directoryExists) {
    return;
  }

  const fileNames = yield* fileSystem.readDirectory(directory);

  const candidatePaths = fileNames
    .filter(isLogFileName)
    .map((fileName) => {
      return path.join(directory, fileName);
    })
    .filter((filePath) => {
      return path.resolve(filePath) !== path.resolve(currentLogFilePath);
    });

  const logFiles = yield* E.forEach(
    candidatePaths,
    (filePath) => {
      return fileSystem.stat(filePath).pipe(
        E.map((info): LogFile => {
          const modifiedAtEpochMilliseconds = Option.match(info.mtime, {
            onNone: () => nowEpochMilliseconds,
            onSome: (mtime) => mtime.getTime(),
          });

          return {
            ageDays:
              (nowEpochMilliseconds - modifiedAtEpochMilliseconds) /
              MILLISECONDS_PER_DAY,
            modifiedAtEpochMilliseconds,
            path: filePath,
          };
        }),
      );
    },
    { concurrency: FILE_OPERATION_CONCURRENCY },
  );

  const expiredFiles = logFiles.filter((logFile) => {
    return logFile.ageDays > PROBLEM_SESSION_RETENTION_DAYS;
  });

  const agingFiles = logFiles.filter((logFile) => {
    return (
      logFile.ageDays > CLEAN_SESSION_RETENTION_DAYS &&
      logFile.ageDays <= PROBLEM_SESSION_RETENTION_DAYS
    );
  });

  const agingFileProblems = yield* E.forEach(
    agingFiles,
    (logFile) => {
      return fileSystem.readFileString(logFile.path).pipe(
        E.map((contents) => {
          return {
            hasProblems: PROBLEM_LEVEL_MARKERS.some((marker) => {
              return contents.includes(marker);
            }),
            logFile,
          };
        }),
      );
    },
    { concurrency: FILE_OPERATION_CONCURRENCY },
  );

  const cleanAgingFiles = agingFileProblems
    .filter(({ hasProblems }) => {
      return !hasProblems;
    })
    .map(({ logFile }) => {
      return logFile;
    });

  const deletedByAge = new Set(
    [...expiredFiles, ...cleanAgingFiles].map((logFile) => {
      return logFile.path;
    }),
  );

  const filesOverCap = logFiles
    .filter((logFile) => {
      return !deletedByAge.has(logFile.path);
    })
    .toSorted((first, second) => {
      return (
        second.modifiedAtEpochMilliseconds - first.modifiedAtEpochMilliseconds
      );
    })
    .slice(MAX_LOG_FILES - 1);

  const filesToDelete = [
    ...deletedByAge,
    ...filesOverCap.map((logFile) => {
      return logFile.path;
    }),
  ];

  yield* E.forEach(
    filesToDelete,
    (filePath) => {
      return fileSystem.remove(filePath).pipe(
        E.catch((cause) => {
          return E.logDebug("Failed to delete an old log file.", {
            cause,
            filePath,
          });
        }),
      );
    },
    { concurrency: FILE_OPERATION_CONCURRENCY, discard: true },
  );
});
