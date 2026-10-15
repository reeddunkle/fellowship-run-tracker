import { TextDecoder } from "node:util";

import * as ByteSize from "effect/ByteSize";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";

import { FileMonitorSource } from "./file-monitor-source-service.ts";
import {
  createFileReadState,
  type FileData,
  type FileReadState,
  isSameFile,
  type ReadAppendedLinesResult,
  splitCompleteLines,
} from "./filesystem.ts";

type StreamLinesOptions = {
  readonly filePath: string;
};

type StreamLatestFileOptions = {
  readonly directoryPath: string;
  readonly getContentStartedAt?: (leadingText: string) => Option.Option<number>;
  readonly matches: (fileName: string) => boolean;
  readonly startFrom: "end" | "start";
};

export type LatestFileItem =
  | {
      readonly _tag: "WaitingForFile";
    }
  | {
      readonly _tag: "Attached";
      readonly file: FileData;
      readonly startOffset: ByteSize.ByteSize;
    }
  | {
      readonly _tag: "Line";
      readonly line: string;
    };

type LatestFileState =
  | {
      readonly _tag: "Starting";
    }
  | {
      readonly _tag: "WaitingForFile";
    }
  | {
      readonly _tag: "Reading";
      readonly readState: FileReadState;
    };

type LatestFileStep = readonly [LatestFileState, ReadonlyArray<LatestFileItem>];

const LEADING_TEXT_BYTES = ByteSize.bytes(1_024);

export type FileMonitorShape = {
  readonly streamLatestFile: (
    options: StreamLatestFileOptions,
  ) => Stream.Stream<LatestFileItem, PlatformError.PlatformError>;

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

  const readAppendedLines: (
    state: FileReadState,
  ) => E.Effect<ReadAppendedLinesResult, PlatformError.PlatformError> = E.fn(
    "FileMonitor.readAppendedLines",
  )(function* (state) {
    const bytesToRead = ByteSize.bytes(state.file.size - state.byteOffset);

    if (bytesToRead === ByteSize.bytes(0)) {
      return {
        lines: [],
        state,
      };
    }

    const chunks = yield* readFileRange({
      bytesToRead,
      filePath: state.file.filePath,
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
        file: state.file,
        incompleteLine: splitResult.incompleteLine,
      },
    };
  });

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

  const readLeadingText = (file: FileData) => {
    return readFileRange({
      bytesToRead:
        file.size < LEADING_TEXT_BYTES ? file.size : LEADING_TEXT_BYTES,
      filePath: file.filePath,
      offset: ByteSize.bytes(0),
    }).pipe(
      E.map((chunks) => {
        return decodeChunks({
          chunks,
          decoder: new TextDecoder(),
        });
      }),
    );
  };

  const streamLatestFile: FileMonitorShape["streamLatestFile"] = ({
    directoryPath,
    getContentStartedAt,
    matches,
    startFrom,
  }) => {
    return Stream.unwrap(
      E.gen(function* () {
        const streamStartedAtMilliseconds = yield* Clock.currentTimeMillis;

        const isFileFromThisStream = (file: FileData) => {
          const isWrittenSinceStreamStarted = () => {
            return isFileWrittenSince({
              file,
              sinceEpochMilliseconds: streamStartedAtMilliseconds,
            });
          };

          if (getContentStartedAt === undefined) {
            return E.succeed(isWrittenSinceStreamStarted());
          }

          return readLeadingText(file).pipe(
            E.map((leadingText) => {
              return Option.match(getContentStartedAt(leadingText), {
                onNone: isWrittenSinceStreamStarted,
                onSome: (contentStartedAtMilliseconds) => {
                  return (
                    contentStartedAtMilliseconds > streamStartedAtMilliseconds
                  );
                },
              });
            }),
          );
        };

        const getStartingByteOffset = (file: FileData) => {
          if (startFrom === "start") {
            return E.succeed(ByteSize.bytes(0));
          }

          return isFileFromThisStream(file).pipe(
            E.map((isFromThisStream) => {
              return isFromThisStream ? ByteSize.bytes(0) : file.size;
            }),
          );
        };

        const readFrom = (
          readState: FileReadState,
        ): E.Effect<LatestFileStep, PlatformError.PlatformError> => {
          return readAppendedLines(readState).pipe(
            E.map((result) => {
              return [
                {
                  _tag: "Reading",
                  readState: result.state,
                },
                result.lines.map((line) => {
                  return {
                    _tag: "Line",
                    line,
                  } satisfies LatestFileItem;
                }),
              ] as const;
            }),
          );
        };

        const attach = ({
          file,
          startOffset,
        }: {
          readonly file: FileData;
          readonly startOffset: ByteSize.ByteSize;
        }): E.Effect<LatestFileStep, PlatformError.PlatformError> => {
          return readFrom(
            createFileReadState({ byteOffset: startOffset, file }),
          ).pipe(
            E.map(([state, lines]) => {
              return [
                state,
                [
                  {
                    _tag: "Attached",
                    file,
                    startOffset,
                  } satisfies LatestFileItem,
                  ...lines,
                ],
              ] as const;
            }),
          );
        };

        const handleLatestFile = (
          state: LatestFileState,
          latestFile: Option.Option<FileData>,
        ): E.Effect<LatestFileStep, PlatformError.PlatformError> => {
          return Option.match(latestFile, {
            onNone: () => {
              if (state._tag === "WaitingForFile") {
                return E.succeed([state, []] as const);
              }

              return E.succeed([
                { _tag: "WaitingForFile" },
                [{ _tag: "WaitingForFile" }],
              ] as const);
            },
            onSome: (file) => {
              if (
                state._tag === "Reading" &&
                isSameFile(file, state.readState.file)
              ) {
                return file.size < state.readState.byteOffset
                  ? attach({ file, startOffset: ByteSize.bytes(0) })
                  : readFrom({ ...state.readState, file });
              }

              return getStartingByteOffset(file).pipe(
                E.flatMap((startOffset) => {
                  return attach({ file, startOffset });
                }),
              );
            },
          });
        };

        return fileMonitorSource
          .streamLatestFile({
            directoryPath,
            matches,
          })
          .pipe(
            Stream.mapAccumEffect((): LatestFileState => {
              return { _tag: "Starting" };
            }, handleLatestFile),
          );
      }),
    );
  };

  return {
    streamLatestFile,
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
