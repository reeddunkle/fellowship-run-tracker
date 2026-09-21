import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import {
  NodeFileSystemLayer,
  NodePathLayer,
  NodePlatformLayer,
} from "@/layers/node-platform-layer.ts";
import { FileMonitorSource } from "@/services/filesystem/file-monitor-source-service.ts";

export const FileMonitorSourceTestLive = Layer.mergeAll(
  Layer.fresh(FileMonitorSource.layer),
  NodePlatformLayer,
);

export function makeFileMonitorSourceFailureTestLive(
  watchError: PlatformError.PlatformError,
) {
  const FailingWatchFileSystemLive = Layer.effect(
    FileSystem.FileSystem,
    E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      return {
        ...fileSystem,
        watch: () => {
          return Stream.fail(watchError);
        },
      } satisfies FileSystem.FileSystem;
    }).pipe(E.provide(NodeFileSystemLayer)),
  );

  const FileMonitorSourceFailureDependenciesLive = Layer.mergeAll(
    FailingWatchFileSystemLive,
    NodePathLayer,
  );

  return Layer.mergeAll(
    Layer.fresh(
      FileMonitorSource.layerNoDeps.pipe(
        Layer.provide(FileMonitorSourceFailureDependenciesLive),
      ),
    ),
    FileMonitorSourceFailureDependenciesLive,
  );
}

export function makeFileMonitorSourceTestHarness() {
  return E.gen(function* () {
    const fileMonitorSource = yield* FileMonitorSource;
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directoryPath = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "file-monitor-source-",
    });

    const getFilePath = (fileName: string): string => {
      return path.join(directoryPath, fileName);
    };

    const writeFile = (fileName: string, contents: string) => {
      return fileSystem.writeFileString(getFilePath(fileName), contents);
    };

    const appendFile = (fileName: string, contents: string) => {
      return fileSystem.writeFileString(getFilePath(fileName), contents, {
        flag: "a",
      });
    };

    const removeFile = (fileName: string) => {
      return fileSystem.remove(getFilePath(fileName));
    };

    const makeDirectory = (directoryName: string) => {
      return fileSystem.makeDirectory(getFilePath(directoryName));
    };

    return {
      appendFile,
      directoryPath,
      fileMonitorSource,
      getFilePath,
      makeDirectory,
      removeFile,
      writeFile,
    };
  });
}
