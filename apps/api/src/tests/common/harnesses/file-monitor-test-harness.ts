import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { FileNotFoundError } from "@frt/api/errors/file-not-found-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { FileMonitor } from "@frt/api/services/filesystem/file-monitor-service.ts";
import {
  FileMonitorSource,
  type FileMonitorSourceShape,
} from "@frt/api/services/filesystem/file-monitor-source-service.ts";
import {
  type FileData,
  getFileId,
} from "@frt/api/services/filesystem/filesystem.ts";
import { getDateEpochMilliseconds } from "@frt/api/util/get-date-epoch-milliseconds.ts";

export type FileMonitorSourceValue = Option.Option<FileData>;

type FileMonitorSourceSignal =
  | {
      readonly _tag: "VALUE";
      readonly value: FileMonitorSourceValue;
    }
  | {
      readonly _tag: "FAILURE";
      readonly error: PlatformError.PlatformError;
    };

export function makeFileMonitorTestHarness() {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directoryPath = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "file-monitor-",
    });

    const sourceSignals = yield* Queue.make<FileMonitorSourceSignal>();
    const sourceRequests = yield* Queue.make<void>();

    const latestSourceValueRef = yield* Ref.make<FileMonitorSourceValue>(
      Option.none(),
    );

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

    const writeFileBytes = (fileName: string, bytes: Uint8Array) => {
      return fileSystem.writeFile(getFilePath(fileName), bytes);
    };

    const appendFileBytes = (fileName: string, bytes: Uint8Array) => {
      return fileSystem.writeFile(getFilePath(fileName), bytes, {
        flag: "a",
      });
    };

    const truncateFile = (fileName: string) => {
      return fileSystem.truncate(getFilePath(fileName));
    };

    const removeFile = (fileName: string) => {
      return fileSystem.remove(getFilePath(fileName));
    };

    const getFileData = (fileName: string) => {
      const filePath = getFilePath(fileName);

      return E.gen(function* () {
        const info = yield* fileSystem.stat(filePath);

        return {
          createdAtEpochMilliseconds: getDateEpochMilliseconds(info.birthtime),
          fileId: getFileId({
            filePath,
            info,
          }),
          filePath,
          modifiedAtEpochMilliseconds: getDateEpochMilliseconds(info.mtime),
          size: info.size,
        } satisfies FileData;
      });
    };

    const emitSourceValue = (value: FileMonitorSourceValue) => {
      return E.gen(function* () {
        yield* Ref.set(latestSourceValueRef, value);

        yield* Queue.offer(sourceSignals, {
          _tag: "VALUE",
          value,
        });
      });
    };

    const emitFile = (fileName: string) => {
      return E.gen(function* () {
        const file = yield* getFileData(fileName);

        yield* emitSourceValue(Option.some(file));

        return file;
      });
    };

    const emitNoFile = emitSourceValue(Option.none());

    const emitSourceFailure = (error: PlatformError.PlatformError) => {
      return Queue.offer(sourceSignals, {
        _tag: "FAILURE",
        error,
      });
    };

    const awaitSourceRequest = Queue.take(sourceRequests);

    const fileMonitorSource = {
      findLatestFile: ({ directoryPath: directoryPathValue }) => {
        return E.gen(function* () {
          const latestSourceValue = yield* Ref.get(latestSourceValueRef);

          if (Option.isNone(latestSourceValue)) {
            return yield* new FileNotFoundError({
              directoryPath: directoryPathValue,
            });
          }

          return latestSourceValue.value;
        });
      },
      streamLatestFile: () => {
        return Stream.fromEffectRepeat(
          E.gen(function* () {
            /*
             * This signal occurs only when FileMonitor asks for another
             * source snapshot. If a previous value was emitted, that means
             * FileMonitor has already finished processing that value.
             */
            yield* Queue.offer(sourceRequests, undefined);

            const signal = yield* Queue.take(sourceSignals);

            if (signal._tag === "FAILURE") {
              return yield* signal.error;
            }

            return signal.value;
          }),
        );
      },
      streamStatus: () => {
        return Stream.empty;
      },
    } satisfies FileMonitorSourceShape;

    const FileMonitorSourceMock = Layer.succeed(
      FileMonitorSource,
      fileMonitorSource,
    );

    const FileMonitorTestDependenciesLive = FileMonitor.layerNoDeps.pipe(
      Layer.provide(Layer.mergeAll(FileMonitorSourceMock, NodePlatformLayer)),
    );

    const fileMonitor = yield* FileMonitor.pipe(
      E.provide(FileMonitorTestDependenciesLive),
    );

    return {
      appendFile,
      appendFileBytes,
      awaitSourceRequest,
      directoryPath,
      emitFile,
      emitNoFile,
      emitSourceFailure,
      emitSourceValue,
      fileMonitor,
      fileSystem,
      getFileData,
      getFilePath,
      removeFile,
      truncateFile,
      writeFile,
      writeFileBytes,
    };
  });
}

export const FileMonitorTestDependenciesLive = NodePlatformLayer;
