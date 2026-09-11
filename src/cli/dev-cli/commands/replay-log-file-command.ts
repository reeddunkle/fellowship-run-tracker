import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import {
  ReplayLogFileEmptyInputError,
  ReplayLogFilePathConflictError,
} from "@/errors/replay-log-file-command-error.ts";
import {
  NonEmptyStringSchema,
  NonNegativeNumberFromStringSchema,
  NonNegativeNumberSchema,
  PositiveIntegerFromStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";

export const ReplayLogFileArgumentsSchema = Schema.Struct({
  initialDelayMilliseconds: Schema.optionalKey(
    NonNegativeNumberFromStringSchema,
  ),
  inputFilePath: NonEmptyStringSchema,
  maxDelayMilliseconds: Schema.optionalKey(NonNegativeNumberFromStringSchema),
  outputFilePath: NonEmptyStringSchema,
  speed: Schema.optionalKey(PositiveIntegerFromStringSchema),
});

export const ReplayLogFileCommandInputSchema = Schema.Struct({
  initialDelayMilliseconds: NonNegativeNumberSchema,
  inputFilePath: NonEmptyStringSchema,
  maxDelayMilliseconds: NonNegativeNumberSchema,
  outputFilePath: NonEmptyStringSchema,
  speed: PositiveIntegerSchema,
});

export type ReplayLogFileCommandInput =
  typeof ReplayLogFileCommandInputSchema.Type;

function getLineTimestamp(line: string): number | undefined {
  const separatorIndex = line.indexOf("|");

  if (separatorIndex === -1) {
    return undefined;
  }

  return DateTime.make(line.slice(0, separatorIndex)).pipe(
    Option.map(DateTime.toEpochMillis),
    Option.getOrUndefined,
  );
}

function setLineTimestamp({
  line,
  timestamp,
}: {
  readonly line: string;
  readonly timestamp: number;
}): string {
  const separatorIndex = line.indexOf("|");

  if (separatorIndex === -1) {
    return line;
  }

  const dateTime = DateTime.make(timestamp);

  if (Option.isNone(dateTime)) {
    return line;
  }

  return `${DateTime.formatIso(dateTime.value)}${line.slice(separatorIndex)}`;
}

function getReplayDelay({
  currentLine,
  maxDelayMilliseconds,
  previousLine,
  speed,
}: {
  readonly currentLine: string;
  readonly maxDelayMilliseconds: number;
  readonly previousLine: string;
  readonly speed: number;
}): number {
  const previousTimestamp = getLineTimestamp(previousLine);
  const currentTimestamp = getLineTimestamp(currentLine);

  if (previousTimestamp === undefined || currentTimestamp === undefined) {
    return 0;
  }

  const originalDelay = Math.max(0, currentTimestamp - previousTimestamp);

  return Math.min(originalDelay / speed, maxDelayMilliseconds);
}

export const runReplayLogFileCommand = E.fn("dev-cli.replay-log-file")(
  function* ({
    initialDelayMilliseconds,
    inputFilePath,
    maxDelayMilliseconds,
    outputFilePath,
    speed,
  }: ReplayLogFileCommandInput) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const resolvedInputPath = path.resolve(inputFilePath);
    const resolvedOutputPath = path.resolve(outputFilePath);

    if (resolvedInputPath === resolvedOutputPath) {
      return yield* new ReplayLogFilePathConflictError({
        inputFilePath: resolvedInputPath,
        outputFilePath: resolvedOutputPath,
      });
    }

    const contents = yield* fileSystem.readFileString(resolvedInputPath);

    const lines = contents.split(/\r?\n/).filter((line) => line.length > 0);

    if (lines.length === 0) {
      return yield* new ReplayLogFileEmptyInputError({
        inputFilePath: resolvedInputPath,
      });
    }

    yield* fileSystem.makeDirectory(path.dirname(resolvedOutputPath), {
      recursive: true,
    });

    yield* fileSystem.writeFileString(resolvedOutputPath, "");

    yield* E.logInfo("Created replay log.", {
      initialDelayMilliseconds,
      lineCount: lines.length,
      maxDelayMilliseconds,
      outputFilePath: resolvedOutputPath,
      speed,
    });

    yield* E.sleep(`${initialDelayMilliseconds} millis`);

    let replayTimestamp = getLineTimestamp(lines[0] ?? "");

    for (const [index, line] of lines.entries()) {
      let replayLine = line;

      if (index > 0) {
        const previousLine = lines[index - 1];

        if (previousLine !== undefined) {
          const delay = getReplayDelay({
            currentLine: line,
            maxDelayMilliseconds,
            previousLine,
            speed,
          });

          if (delay > 0) {
            yield* E.sleep(`${delay} millis`);
          }

          const currentTimestamp = getLineTimestamp(line);

          if (replayTimestamp !== undefined && currentTimestamp !== undefined) {
            replayTimestamp += delay;

            replayLine = setLineTimestamp({
              line,
              timestamp: replayTimestamp,
            });
          } else if (currentTimestamp !== undefined) {
            replayTimestamp = currentTimestamp;
          }
        }
      } else if (replayTimestamp !== undefined) {
        replayLine = setLineTimestamp({
          line,
          timestamp: replayTimestamp,
        });
      }

      yield* fileSystem.writeFileString(
        resolvedOutputPath,
        `${replayLine}\r\n`,
        {
          flag: "a",
        },
      );

      yield* E.logDebug(`[${index + 1}/${lines.length}] ${replayLine}`);
    }

    yield* E.logInfo("Log replay completed.", {
      outputFilePath: resolvedOutputPath,
    });
  },
);
