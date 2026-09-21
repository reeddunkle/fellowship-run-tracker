import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Logger from "effect/Logger";

const LOG_DIRECTORY = "./logs";

function getLogFileName() {
  return E.gen(function* () {
    const now = yield* DateTime.now;
    const date = DateTime.formatIsoDateUtc(now);

    return `${LOG_DIRECTORY}/${date}-fellowship-run-tracker.log`;
  });
}

const FileLogger = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  yield* fileSystem.makeDirectory(LOG_DIRECTORY, {
    recursive: true,
  });

  const logFileName = yield* getLogFileName();

  return yield* Logger.toFile(Logger.formatJson, logFileName);
});

export const AppLoggerLayer = Logger.layer([
  Logger.consolePretty(),
  FileLogger,
]);
