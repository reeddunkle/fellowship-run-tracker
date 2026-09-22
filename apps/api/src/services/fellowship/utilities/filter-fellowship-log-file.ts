import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import { parseFellowshipEventStream } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";

export type FilterFellowshipLogFileOptions = {
  readonly inputFilePath: string;
  readonly outputFilePath: string;
};

export type FilterFellowshipLogFileResult = {
  readonly retainedLineCount: number;
  readonly totalLineCount: number;
};

export type FilterFellowshipLogFileError = PlatformError.PlatformError;

type FilterLineResult = {
  readonly isRelevant: boolean;
  readonly line: string;
};

function inspectLogLine(line: string): E.Effect<FilterLineResult> {
  return parseFellowshipEventStream(Stream.make(line)).pipe(
    Stream.runCollect,
    E.map((events) => {
      return {
        isRelevant: events.length > 0,
        line,
      };
    }),
  );
}

export function filterFellowshipLogFile({
  inputFilePath,
  outputFilePath,
}: FilterFellowshipLogFileOptions): E.Effect<
  FilterFellowshipLogFileResult,
  FilterFellowshipLogFileError,
  FileSystem.FileSystem
> {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    const results = yield* fileSystem
      .stream(inputFilePath)
      .pipe(
        Stream.decodeText,
        Stream.splitLines,
        Stream.mapEffect(inspectLogLine),
        Stream.runCollect,
      );

    const relevantLines = results
      .filter((result) => {
        return result.isRelevant;
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
}
