import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { isPackagedElectronApp } from "@frt/api/helpers/is-packaged-electron-app.ts";
import {
  NodeFileSystemLayer,
  NodePlatformLayer,
} from "@frt/api/layers/node-platform-layer.ts";
import { SESSION_LOG_FILE_PATH } from "@frt/api/logging/log-file-path.ts";
import { resolveProcessLogLevel } from "@frt/api/logging/log-level.ts";
import { pruneLogFiles } from "@frt/api/logging/prune-log-files.ts";

const FileLogger = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  yield* fileSystem.makeDirectory(appPaths.logs, {
    recursive: true,
  });

  return yield* Logger.toFile(Logger.formatJson, SESSION_LOG_FILE_PATH);
});

const LoggersLayer = Logger.layer(
  isPackagedElectronApp() ? [FileLogger] : [Logger.consolePretty(), FileLogger],
).pipe(Layer.provide(NodeFileSystemLayer));

const MinimumLogLevelLayer = Layer.succeed(
  References.MinimumLogLevel,
  resolveProcessLogLevel(),
);

const LogFileRetentionLayer = Layer.effectDiscard(
  pruneLogFiles({
    currentLogFilePath: SESSION_LOG_FILE_PATH,
    directory: appPaths.logs,
  }).pipe(
    E.catch((cause) => {
      return E.logWarning("Failed to clean up old log files.", {
        cause,
      });
    }),
    E.forkScoped,
  ),
).pipe(Layer.provide(NodePlatformLayer));

export const AppLoggerLayer = LogFileRetentionLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(LoggersLayer, MinimumLogLevelLayer)),
);
