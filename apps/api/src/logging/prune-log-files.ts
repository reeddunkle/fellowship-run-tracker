import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";

import { parseSessionFileName } from "@frt/api/logging/log-file-path.ts";

const CLEAN_SESSION_RETENTION_DAYS = 30;

const PROBLEM_SESSION_RETENTION_DAYS = 90;

const MAX_SESSIONS = 200;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const PROBLEM_LEVEL_MARKERS = [
  '"level":"WARN"',
  '"level":"ERROR"',
  '"level":"FATAL"',
];

const FILE_OPERATION_CONCURRENCY = 8;

type SessionFile = {
  readonly isLog: boolean;
  readonly modifiedAtEpochMilliseconds: number;
  readonly path: string;
  readonly sessionName: string;
};

type Session = {
  readonly ageDays: number;
  readonly logPath: Option.Option<string>;
  readonly modifiedAtEpochMilliseconds: number;
  readonly paths: ReadonlyArray<string>;
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

  const currentSessionName = parseSessionFileName(
    path.basename(currentLogFilePath),
  ).pipe(
    Option.map(({ sessionName }) => {
      return sessionName;
    }),
  );

  const fileNames = yield* fileSystem.readDirectory(directory);

  const candidates = A.getSomes(
    fileNames.map((fileName) => {
      return Option.map(parseSessionFileName(fileName), (parsed) => {
        return { ...parsed, path: path.join(directory, fileName) };
      });
    }),
  ).filter((candidate) => {
    return (
      !Option.contains(currentSessionName, candidate.sessionName) &&
      path.resolve(candidate.path) !== path.resolve(currentLogFilePath)
    );
  });

  const sessionFiles = yield* E.forEach(
    candidates,
    (candidate) => {
      return fileSystem.stat(candidate.path).pipe(
        E.map((info): SessionFile => {
          return {
            ...candidate,
            modifiedAtEpochMilliseconds: Option.match(info.mtime, {
              onNone: () => nowEpochMilliseconds,
              onSome: (mtime) => mtime.getTime(),
            }),
          };
        }),
      );
    },
    { concurrency: FILE_OPERATION_CONCURRENCY },
  );

  const sessions = R.values(
    A.groupBy(sessionFiles, (file) => {
      return file.sessionName;
    }),
  ).map((files): Session => {
    const modifiedAtEpochMilliseconds = Math.max(
      ...files.map((file) => {
        return file.modifiedAtEpochMilliseconds;
      }),
    );

    return {
      ageDays:
        (nowEpochMilliseconds - modifiedAtEpochMilliseconds) /
        MILLISECONDS_PER_DAY,
      logPath: Option.fromUndefinedOr(
        files.find((file) => {
          return file.isLog;
        })?.path,
      ),
      modifiedAtEpochMilliseconds,
      paths: files.map((file) => {
        return file.path;
      }),
    };
  });

  const expiredSessions = sessions.filter((session) => {
    return session.ageDays > PROBLEM_SESSION_RETENTION_DAYS;
  });

  const agingSessions = sessions.filter((session) => {
    return (
      session.ageDays > CLEAN_SESSION_RETENTION_DAYS &&
      session.ageDays <= PROBLEM_SESSION_RETENTION_DAYS
    );
  });

  const agingSessionProblems = yield* E.forEach(
    agingSessions,
    (session) => {
      return Option.match(session.logPath, {
        onNone: () => E.succeed(false),
        onSome: (logPath) => {
          return fileSystem.readFileString(logPath).pipe(
            E.map((contents) => {
              return PROBLEM_LEVEL_MARKERS.some((marker) => {
                return contents.includes(marker);
              });
            }),
          );
        },
      }).pipe(
        E.map((hasProblems) => {
          return { hasProblems, session };
        }),
      );
    },
    { concurrency: FILE_OPERATION_CONCURRENCY },
  );

  const cleanAgingSessions = agingSessionProblems
    .filter(({ hasProblems }) => {
      return !hasProblems;
    })
    .map(({ session }) => {
      return session;
    });

  const deletedByAge = new Set([...expiredSessions, ...cleanAgingSessions]);

  const sessionsOverCap = sessions
    .filter((session) => {
      return !deletedByAge.has(session);
    })
    .toSorted((first, second) => {
      return (
        second.modifiedAtEpochMilliseconds - first.modifiedAtEpochMilliseconds
      );
    })
    .slice(MAX_SESSIONS - 1);

  const filesToDelete = [...deletedByAge, ...sessionsOverCap].flatMap(
    (session) => {
      return session.paths;
    },
  );

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
