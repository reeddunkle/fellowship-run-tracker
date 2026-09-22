import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";

import {
  ReplayLogFileEmptyInputError,
  ReplayLogFilePathConflictError,
} from "@frt/cli/errors/replay-log-error.ts";
import {
  NonEmptyStringSchema,
  NonNegativeNumberSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";

type ReplayLogCommandInput = {
  readonly initialDelayMilliseconds: number;
  readonly inputFilePath: string;
  readonly maxDelayMilliseconds: number;
  readonly outputFilePath: string;
  readonly speed: number;
};

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

const runReplayLogCommand = E.fn("cli.replay-log")(function* ({
  initialDelayMilliseconds,
  inputFilePath,
  maxDelayMilliseconds,
  outputFilePath,
  speed,
}: ReplayLogCommandInput) {
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

    yield* fileSystem.writeFileString(resolvedOutputPath, `${replayLine}\r\n`, {
      flag: "a",
    });

    yield* E.logDebug(`[${index + 1}/${lines.length}] ${replayLine}`);
  }

  yield* E.logInfo("Log replay completed.", {
    outputFilePath: resolvedOutputPath,
  });
});

export const replayLogCommand = Command.make(
  "replay-log",
  {
    initialDelayMilliseconds: Flag.float("initial-delay").pipe(
      Flag.withSchema(NonNegativeNumberSchema),
      Flag.withDefault(1_000),
      Flag.withDescription("Milliseconds to wait before the first line."),
    ),
    inputFilePath: Flag.string("input").pipe(
      Flag.withAlias("i"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Existing Fellowship combat log to replay."),
    ),
    maxDelayMilliseconds: Flag.float("max-delay").pipe(
      Flag.withSchema(NonNegativeNumberSchema),
      Flag.withDefault(10_000),
      Flag.withDescription("Longest wait between two replayed lines."),
    ),
    outputFilePath: Flag.string("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription(
        "Where to write the replayed log (e.g. the Fellowship log directory).",
      ),
    ),
    speed: Flag.integer("speed").pipe(
      Flag.withAlias("s"),
      Flag.withSchema(PositiveIntegerSchema),
      Flag.withDefault(1),
      Flag.withDescription("Replay speed multiplier."),
    ),
  },
  runReplayLogCommand,
).pipe(
  Command.withDescription(
    "Replay a combat log in real time with fresh timestamps, to test tracking without playing.",
  ),
);
