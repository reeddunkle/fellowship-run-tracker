import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

import { FileNotFoundError } from "@/errors/file-not-found-error.ts";
import { NodePlatformLayer } from "@/layers/node-platform-layer.ts";
import { getDateEpochMilliseconds } from "@/util/get-date-epoch-milliseconds.ts";

import { compareFiles, type FileData, getFileId } from "./filesystem.ts";

type FileMonitorSourceStatus =
  | {
      readonly _tag: "WAITING_FOR_FILE";
      readonly directoryPath: string;
    }
  | {
      readonly _tag: "MONITORING";
      readonly directoryPath: string;
      readonly filePath: string;
    };

type FileWatchSignal =
  | {
      readonly _tag: "EVENT";
      readonly event: FileSystem.WatchEvent;
    }
  | {
      readonly _tag: "FAILURE";
      readonly error: PlatformError.PlatformError;
    };

type FindLatestFileOptions = {
  readonly directoryPath: string;
  readonly matches: (fileName: string) => boolean;
};

type StreamLatestFileOptions = FindLatestFileOptions;

type StreamStatusOptions = FindLatestFileOptions;

export type FileMonitorSourceService = {
  readonly findLatestFile: (
    options: FindLatestFileOptions,
  ) => E.Effect<FileData, FileNotFoundError | PlatformError.PlatformError>;

  readonly streamLatestFile: (
    options: StreamLatestFileOptions,
  ) => Stream.Stream<Option.Option<FileData>, PlatformError.PlatformError>;

  readonly streamStatus: (
    options: StreamStatusOptions,
  ) => Stream.Stream<FileMonitorSourceStatus, PlatformError.PlatformError>;
};

const makeFileMonitorSource = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const findLatestFile: FileMonitorSourceService["findLatestFile"] = ({
    directoryPath,
    matches,
  }) => {
    return E.gen(function* () {
      const entries = yield* fileSystem.readDirectory(directoryPath);

      const candidates = yield* E.forEach(entries, (entry) => {
        return E.gen(function* () {
          if (!matches(entry)) {
            return undefined;
          }

          const filePath = path.join(directoryPath, entry);
          const info = yield* fileSystem.stat(filePath);

          if (info.type !== "File") {
            return undefined;
          }

          return {
            createdAtEpochMilliseconds: getDateEpochMilliseconds(
              info.birthtime,
            ),
            fileId: getFileId({
              filePath,
              info,
            }),
            filePath,
            modifiedAtEpochMilliseconds: getDateEpochMilliseconds(info.mtime),
            size: info.size,
          } satisfies FileData;
        });
      });

      const latestFile = candidates
        .filter((candidate): candidate is FileData => {
          return candidate !== undefined;
        })
        .toSorted(compareFiles)
        .at(0);

      if (latestFile === undefined) {
        return yield* new FileNotFoundError({
          directoryPath,
        });
      }

      return latestFile;
    });
  };

  const getLatestFileOption = (
    options: FindLatestFileOptions,
  ): E.Effect<Option.Option<FileData>, PlatformError.PlatformError> => {
    return findLatestFile(options).pipe(
      E.matchEffect({
        onFailure: (error) => {
          if (error._tag === "FileNotFoundError") {
            return E.succeed(Option.none<FileData>());
          }

          return E.fail(error);
        },
        onSuccess: (file) => {
          return E.succeedSome(file);
        },
      }),
    );
  };

  const streamLatestFile: FileMonitorSourceService["streamLatestFile"] = (
    options,
  ) => {
    return E.gen(function* () {
      const watchSignals = yield* Queue.make<FileWatchSignal>();

      yield* fileSystem.watch(options.directoryPath).pipe(
        Stream.runForEach((watchEvent) => {
          return Queue.offer(watchSignals, {
            _tag: "EVENT",
            event: watchEvent,
          });
        }),
        E.catch((error) => {
          return Queue.offer(watchSignals, {
            _tag: "FAILURE",
            error,
          });
        }),
        E.forkScoped,
      );

      const initialLatestFile = yield* getLatestFileOption(options);

      const latestFileChanges = Stream.fromQueue(watchSignals).pipe(
        Stream.mapEffect((signal) => {
          if (signal._tag === "FAILURE") {
            return E.fail(signal.error);
          }

          return getLatestFileOption(options);
        }),
      );

      return Stream.concat(
        Stream.succeed(initialLatestFile),
        latestFileChanges,
      );
    }).pipe(Stream.unwrap, Stream.scoped);
  };

  const streamStatus: FileMonitorSourceService["streamStatus"] = (options) => {
    return streamLatestFile(options).pipe(
      Stream.map((latestFile) => {
        return Option.match(latestFile, {
          onNone: () => {
            return {
              _tag: "WAITING_FOR_FILE",
              directoryPath: options.directoryPath,
            } satisfies FileMonitorSourceStatus;
          },
          onSome: (file) => {
            return {
              _tag: "MONITORING",
              directoryPath: options.directoryPath,
              filePath: file.filePath,
            } satisfies FileMonitorSourceStatus;
          },
        });
      }),
      Stream.changesWith((left, right) => {
        return (
          left._tag === right._tag &&
          left.directoryPath === right.directoryPath &&
          (left._tag !== "MONITORING" ||
            (right._tag === "MONITORING" && left.filePath === right.filePath))
        );
      }),
    );
  };

  return {
    findLatestFile,
    streamLatestFile,
    streamStatus,
  } satisfies FileMonitorSourceService;
});

export class FileMonitorSource extends Context.Service<
  FileMonitorSource,
  FileMonitorSourceService
>()(
  "fellowship-run-tracker/services/filesystem/file-monitor-source-service/FileMonitorSource",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFileMonitorSource);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(NodePlatformLayer),
  );
}
