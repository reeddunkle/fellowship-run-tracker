import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { isPackagedElectronApp } from "@frt/api/helpers/is-packaged-electron-app.ts";
import { NodeFileSystemLayer } from "@frt/api/layers/node-platform-layer.ts";
import { SESSION_LOG_FILE_PATH } from "@frt/api/logging/log-file-path.ts";
import { resolveProcessLogLevel } from "@frt/api/logging/log-level.ts";

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

export const AppLoggerLayer = Layer.mergeAll(
  LoggersLayer,
  MinimumLogLevelLayer,
);
