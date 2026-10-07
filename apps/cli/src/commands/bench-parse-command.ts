import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Stream from "effect/Stream";

import { parseFellowshipEventStream } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";
import { getMedian } from "@frt/api/util/statistics/get-median.ts";
import { getMinimum } from "@frt/api/util/statistics/get-minimum.ts";
import { getPercentile } from "@frt/api/util/statistics/get-percentile.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

type BenchParseCommandInput = {
  readonly inputFilePath: string;
  readonly iterations: number;
  readonly warmupIterations: number;
};

function roundMilliseconds(milliseconds: number): number {
  return Math.round(milliseconds * 1_000) / 1_000;
}

const countFellowshipLogEvents = E.fnUntraced(function* (
  inputFilePath: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;

  return yield* fileSystem.stream(inputFilePath).pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filter((line) => {
      return line !== "";
    }),
    parseFellowshipEventStream,
    Stream.runCount,
  );
});

const runBenchParseCommand = E.fn("runBenchParseCommand")(function* (
  input: BenchParseCommandInput,
) {
  yield* E.replicateEffect(
    countFellowshipLogEvents(input.inputFilePath),
    input.warmupIterations,
    { discard: true },
  );

  const samples = yield* E.replicateEffect(
    E.timed(countFellowshipLogEvents(input.inputFilePath)),
    input.iterations,
  );

  const durations = samples.map(([duration]) => Duration.toMillis(duration));
  const [, eventCount] = samples[0] ?? [Duration.zero, 0];

  yield* E.logInfo(`Parsed ${input.inputFilePath}.`, {
    eventCount,
    iterations: input.iterations,
    medianMilliseconds: roundMilliseconds(getMedian(durations)),
    minimumMilliseconds: roundMilliseconds(getMinimum(durations)),
    p95Milliseconds: roundMilliseconds(getPercentile(durations, 95)),
    warmupIterations: input.warmupIterations,
  });
});

export const benchParseCommand = Command.make(
  "bench-parse",
  {
    inputFilePath: Flag.String("log").pipe(
      Flag.withAlias("l"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Fellowship combat log to parse."),
    ),
    iterations: Flag.Int("iterations").pipe(
      Flag.withAlias("n"),
      Flag.withSchema(PositiveIntegerSchema),
      Flag.withDefault(50),
      Flag.withDescription("Timed parses of the log."),
    ),
    warmupIterations: Flag.Int("warmup").pipe(
      Flag.withSchema(NonNegativeIntegerSchema),
      Flag.withDefault(10),
      Flag.withDescription("Untimed parses run before the timed ones."),
    ),
  },
  runBenchParseCommand,
).pipe(
  Command.withDescription(
    "Time parsing a combat log into Fellowship events, from file to events.",
  ),
);
