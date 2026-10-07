import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import {
  ReplayLogFileEmptyInputError,
  ReplayLogFilePathConflictError,
} from "@frt/api/errors/replay-log-error.ts";

const FIELD_SEPARATOR = "|";
const LINE_ENDING = "\r\n";
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export type ReplayFellowshipLogFileOptions = {
  readonly batchIntervalMilliseconds: number;
  readonly initialDelayMilliseconds: number;
  readonly inputFilePath: string;
  readonly maxDelayMilliseconds: number;
  readonly outputFilePath: string;
  readonly speed: number;
};

type ParsedLine = {
  readonly fields: ReadonlyArray<string>;
  readonly originalTimestamp: Option.Option<number>;
};

type ScheduledLine = ParsedLine & {
  readonly offsetMilliseconds: number;
};

type ReplayBatch = {
  readonly lines: ScheduledLine[];
  readonly offsetMilliseconds: number;
};

function parseTimestamp(text: string): Option.Option<number> {
  if (!TIMESTAMP_PATTERN.test(text)) {
    return Option.none();
  }

  return DateTime.make(text).pipe(Option.map(DateTime.toEpochMillis));
}

function formatTimestamp(timestamp: number): string {
  return DateTime.formatIso(DateTime.makeUnsafe(Math.round(timestamp)));
}

function parseLine(line: string): ParsedLine {
  const fields = line.split(FIELD_SEPARATOR);

  return {
    fields,
    originalTimestamp:
      fields.length > 1 ? parseTimestamp(fields[0] ?? "") : Option.none(),
  };
}

function getReplayDelay({
  current,
  maxDelayMilliseconds,
  previous,
  speed,
}: {
  readonly current: ParsedLine;
  readonly maxDelayMilliseconds: number;
  readonly previous: ParsedLine;
  readonly speed: number;
}): number {
  if (
    Option.isNone(previous.originalTimestamp) ||
    Option.isNone(current.originalTimestamp)
  ) {
    return 0;
  }

  const originalDelay = Math.max(
    0,
    current.originalTimestamp.value - previous.originalTimestamp.value,
  );

  return Math.min(originalDelay / speed, maxDelayMilliseconds);
}

function scheduleLines({
  lines,
  maxDelayMilliseconds,
  speed,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly maxDelayMilliseconds: number;
  readonly speed: number;
}): ReadonlyArray<ScheduledLine> {
  return lines.map(parseLine).reduce<ScheduledLine[]>((scheduled, current) => {
    const previous = scheduled.at(-1);

    scheduled.push({
      ...current,
      offsetMilliseconds:
        previous === undefined
          ? 0
          : previous.offsetMilliseconds +
            getReplayDelay({ current, maxDelayMilliseconds, previous, speed }),
    });

    return scheduled;
  }, []);
}

function groupBatches({
  batchIntervalMilliseconds,
  lines,
}: {
  readonly batchIntervalMilliseconds: number;
  readonly lines: ReadonlyArray<ScheduledLine>;
}): ReadonlyArray<ReplayBatch> {
  return lines.reduce<ReplayBatch[]>((batches, line) => {
    const currentBatch = batches.at(-1);

    if (
      currentBatch !== undefined &&
      line.offsetMilliseconds - currentBatch.offsetMilliseconds <
        batchIntervalMilliseconds
    ) {
      currentBatch.lines.push(line);
    } else {
      batches.push({
        lines: [line],
        offsetMilliseconds: line.offsetMilliseconds,
      });
    }

    return batches;
  }, []);
}

function formatReplayLine({
  line,
  replayStartedAt,
  speed,
}: {
  readonly line: ScheduledLine;
  readonly replayStartedAt: number;
  readonly speed: number;
}): string {
  return Option.match(line.originalTimestamp, {
    onNone: () => {
      return line.fields.join(FIELD_SEPARATOR);
    },
    onSome: (originalTimestamp) => {
      const replayTimestamp = replayStartedAt + line.offsetMilliseconds;

      return line.fields
        .map((field, index) => {
          if (index === 0) {
            return formatTimestamp(replayTimestamp);
          }

          return Option.match(parseTimestamp(field), {
            onNone: () => {
              return field;
            },
            onSome: (fieldTimestamp) => {
              return formatTimestamp(
                replayTimestamp + (fieldTimestamp - originalTimestamp) / speed,
              );
            },
          });
        })
        .join(FIELD_SEPARATOR);
    },
  });
}

export const replayFellowshipLogFile = E.fn("replayFellowshipLogFile")(
  function* ({
    batchIntervalMilliseconds,
    initialDelayMilliseconds,
    inputFilePath,
    maxDelayMilliseconds,
    outputFilePath,
    speed,
  }: ReplayFellowshipLogFileOptions) {
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

    const lines = contents.split(/\r?\n/).filter((line) => {
      return line.length > 0;
    });

    if (lines.length === 0) {
      return yield* new ReplayLogFileEmptyInputError({
        inputFilePath: resolvedInputPath,
      });
    }

    const batches = groupBatches({
      batchIntervalMilliseconds,
      lines: scheduleLines({ lines, maxDelayMilliseconds, speed }),
    });

    yield* fileSystem.makeDirectory(path.dirname(resolvedOutputPath), {
      recursive: true,
    });

    yield* fileSystem.writeFileString(resolvedOutputPath, "");

    yield* E.logInfo("Created replay log.", {
      batchCount: batches.length,
      initialDelayMilliseconds,
      lineCount: lines.length,
      maxDelayMilliseconds,
      outputFilePath: resolvedOutputPath,
      speed,
    });

    yield* E.sleep(Duration.millis(initialDelayMilliseconds));

    const replayStartedAt = yield* Clock.currentTimeMillis;

    const writeBatch = E.fnUntraced(function* (batch: ReplayBatch) {
      const now = yield* Clock.currentTimeMillis;
      const waitMilliseconds = replayStartedAt + batch.offsetMilliseconds - now;

      if (waitMilliseconds > 0) {
        yield* E.sleep(Duration.millis(waitMilliseconds));
      }

      const text = batch.lines
        .map((line) => {
          return `${formatReplayLine({ line, replayStartedAt, speed })}${LINE_ENDING}`;
        })
        .join("");

      yield* fileSystem.writeFileString(resolvedOutputPath, text, {
        flag: "a",
      });

      yield* E.logDebug("Replayed log lines.", {
        lineCount: batch.lines.length,
        offsetMilliseconds: batch.offsetMilliseconds,
      });
    });

    yield* E.forEach(batches, writeBatch, { discard: true });

    yield* E.logInfo("Log replay completed.", {
      outputFilePath: resolvedOutputPath,
    });
  },
);
