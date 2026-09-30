import { type TextDecoder } from "node:util";

import * as ByteSize from "effect/ByteSize";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import { type FileNotFoundError } from "@frt/api/errors/file-not-found-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";

import { FileMonitorSource } from "./file-monitor-source-service.ts";
import {
  createFileReadState,
  createFileReadStateFromBeginning,
  type FileData,
  isSameFile,
  type ReadAppendedLinesOptions,
  type ReadAppendedLinesResult,
  splitCompleteLines,
} from "./filesystem.ts";

export type FileMonitorError = FileNotFoundError | PlatformError.PlatformError;

type FindLatestFileOptions = {
  readonly directoryPath: string;
  readonly matches: (fileName: string) => boolean;
};

type ReadLinesOptions = {
  readonly filePath: string;
};

type StreamLinesOptions = {
  readonly filePath: string;
};

type StreamLatestFileLinesOptions = {
  readonly directoryPath: string;
  readonly matches: (fileName: string) => boolean;
  readonly startFrom: "end" | "start";
};

export type FileMonitorShape = {
  readonly findLatestFile: (
    options: FindLatestFileOptions,
  ) => E.Effect<FileData, FileMonitorError>;

  readonly readLines: (
    options: ReadLinesOptions,
  ) => E.Effect<ReadonlyArray<string>, PlatformError.PlatformError>;

  readonly streamLatestFileLines: (
    options: StreamLatestFileLinesOptions,
  ) => Stream.Stream<string, PlatformError.PlatformError>;

  readonly streamLines: (
    options: StreamLinesOptions,
  ) => Stream.Stream<string, PlatformError.PlatformError>;
};

type ReadFileRangeOptions = {
  readonly bytesToRead: ByteSize.ByteSize;
  readonly filePath: string;
  readonly offset: ByteSize.ByteSize;
};

type DecodeChunksOptions = {
  readonly chunks: ReadonlyArray<Uint8Array>;
  readonly decoder: TextDecoder;
};

function isFileWrittenSince({
  file,
  sinceEpochMilliseconds,
}: {
  readonly file: FileData;
  readonly sinceEpochMilliseconds: number;
}): boolean {
  return (
    file.createdAtEpochMilliseconds > sinceEpochMilliseconds &&
    file.modifiedAtEpochMilliseconds > sinceEpochMilliseconds
  );
}

const makeFileMonitor = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const fileMonitorSource = yield* FileMonitorSource;

  const findLatestFile: FileMonitorShape["findLatestFile"] = (options) => {
    return fileMonitorSource.findLatestFile(options);
  };

  const readFileRange = ({
    bytesToRead,
    filePath,
    offset,
  }: ReadFileRangeOptions): E.Effect<
    ReadonlyArray<Uint8Array>,
    PlatformError.PlatformError
  > => {
    return fileSystem
      .stream(filePath, {
        bytesToRead,
        offset,
      })
      .pipe(Stream.runCollect);
  };

  const decodeChunks = ({ chunks, decoder }: DecodeChunksOptions): string => {
    return chunks
      .map((chunk) => {
        return decoder.decode(chunk, {
          stream: true,
        });
      })
      .join("");
  };

  const readAppendedLines = ({
    file,
    state,
  }: ReadAppendedLinesOptions): E.Effect<
    ReadAppendedLinesResult,
    PlatformError.PlatformError
  > => {
    return E.gen(function* () {
      if (!isSameFile(file, state.file)) {
        return yield* readAppendedLines({
          file,
          state: createFileReadStateFromBeginning(file),
        });
      }

      if (file.size < state.byteOffset) {
        return yield* readAppendedLines({
          file,
          state: createFileReadStateFromBeginning(file),
        });
      }

      const bytesToRead = ByteSize.bytes(file.size - state.byteOffset);

      if (bytesToRead === ByteSize.bytes(0)) {
        return {
          lines: [],
          state: {
            ...state,
            file,
          },
        };
      }

      const chunks = yield* readFileRange({
        bytesToRead,
        filePath: file.filePath,
        offset: state.byteOffset,
      });

      const bytesRead = chunks.reduce((total, chunk) => {
        return total + BigInt(chunk.byteLength);
      }, BigInt(0));

      const appendedText = decodeChunks({
        chunks,
        decoder: state.decoder,
      });

      const splitResult = splitCompleteLines({
        incompleteLine: state.incompleteLine,
        text: appendedText,
      });

      return {
        lines: splitResult.lines,
        state: {
          byteOffset: ByteSize.bytes(state.byteOffset + bytesRead),
          decoder: state.decoder,
          file,
          incompleteLine: splitResult.incompleteLine,
        },
      };
    });
  };

  const streamLines = ({
    filePath,
  }: StreamLinesOptions): Stream.Stream<
    string,
    PlatformError.PlatformError
  > => {
    return fileSystem.stream(filePath).pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.filter((line) => line.length > 0),
    );
  };

  const readLines = ({
    filePath,
  }: ReadLinesOptions): E.Effect<
    ReadonlyArray<string>,
    PlatformError.PlatformError
  > => {
    return streamLines({
      filePath,
    }).pipe(Stream.runCollect);
  };

  const streamLatestFileLines: FileMonitorShape["streamLatestFileLines"] = ({
    directoryPath,
    matches,
    startFrom,
  }) => {
    return Stream.unwrap(
      E.gen(function* () {
        const streamStartedAtMilliseconds = yield* Clock.currentTimeMillis;

        const getStartingByteOffset = (file: FileData) => {
          const isStartOfFileWanted =
            startFrom === "start" ||
            isFileWrittenSince({
              file,
              sinceEpochMilliseconds: streamStartedAtMilliseconds,
            });

          return isStartOfFileWanted ? ByteSize.bytes(0) : file.size;
        };

        const readFrom = (state: ReturnType<typeof createFileReadState>) => {
          return readAppendedLines({
            file: state.file,
            state,
          }).pipe(
            E.map((result) => {
              return [Option.some(result.state), result.lines] as const;
            }),
          );
        };

        return fileMonitorSource
          .streamLatestFile({
            directoryPath,
            matches,
          })
          .pipe(
            Stream.mapAccumEffect(
              () => Option.none<ReturnType<typeof createFileReadState>>(),
              (state, latestFile) => {
                return Option.match(latestFile, {
                  onNone: () => {
                    return E.succeed([state, []] as const);
                  },
                  onSome: (file) => {
                    const newFileState = createFileReadState({
                      byteOffset: getStartingByteOffset(file),
                      file,
                    });

                    return Option.match(state, {
                      onNone: () => {
                        return readFrom(newFileState);
                      },
                      onSome: (currentState) => {
                        return isSameFile(file, currentState.file)
                          ? readFrom({ ...currentState, file })
                          : readFrom(newFileState);
                      },
                    });
                  },
                });
              },
            ),
          );
      }),
    );
  };

  return {
    findLatestFile,
    readLines,
    streamLatestFileLines,
    streamLines,
  } satisfies FileMonitorShape;
});

export class FileMonitor extends Context.Service<
  FileMonitor,
  FileMonitorShape
>()("@frt/api/services/filesystem/file-monitor-service/FileMonitor") {
  static readonly layerNoDeps = Layer.effect(this, makeFileMonitor);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(Layer.mergeAll(FileMonitorSource.layer, NodePlatformLayer)),
  );
}
