import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import { inspectFellowshipLogLines } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";

export type FilterFellowshipLogFileOptions = {
  readonly inputFilePath: string;
  readonly outputFilePath: string;
};

export type FilterFellowshipLogFileResult = {
  readonly retainedLineCount: number;
  readonly totalLineCount: number;
};

export type FilterFellowshipLogFileError = PlatformError.PlatformError;

export const filterFellowshipLogFile: (
  options: FilterFellowshipLogFileOptions,
) => E.Effect<
  FilterFellowshipLogFileResult,
  FilterFellowshipLogFileError,
  FileSystem.FileSystem
> = E.fn("filterFellowshipLogFile")(function* ({
  inputFilePath,
  outputFilePath,
}) {
  const fileSystem = yield* FileSystem.FileSystem;

  const results = yield* fileSystem
    .stream(inputFilePath)
    .pipe(
      Stream.decodeText,
      Stream.splitLines,
      inspectFellowshipLogLines,
      Stream.runCollect,
    );

  const relevantLines = results
    .filter((result) => {
      return result.event !== undefined;
    })
    .map((result) => {
      return result.line;
    });

  const contents =
    relevantLines.length === 0 ? "" : `${relevantLines.join("\n")}\n`;

  yield* fileSystem.writeFileString(outputFilePath, contents);

  return {
    retainedLineCount: relevantLines.length,
    totalLineCount: results.length,
  };
});
