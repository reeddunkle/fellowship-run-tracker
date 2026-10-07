import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";

import { replayFellowshipLogFile } from "@frt/api/services/fellowship/utilities/replay-fellowship-log-file.ts";
import {
  NonEmptyStringSchema,
  NonNegativeNumberSchema,
  PositiveNumberSchema,
} from "@frt/shared/util/common-schemas.ts";

export const replayLogCommand = Command.make(
  "replay-log",
  {
    batchIntervalMilliseconds: Flag.Finite("batch-interval").pipe(
      Flag.withSchema(NonNegativeNumberSchema),
      Flag.withDefault(0),
      Flag.withDescription(
        "Milliseconds of replay time to collect into one write. 0 writes each line on its own.",
      ),
    ),
    initialDelayMilliseconds: Flag.Finite("initial-delay").pipe(
      Flag.withSchema(NonNegativeNumberSchema),
      Flag.withDefault(1_000),
      Flag.withDescription("Milliseconds to wait before the first line."),
    ),
    inputFilePath: Flag.String("input").pipe(
      Flag.withAlias("i"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Existing Fellowship combat log to replay."),
    ),
    maxDelayMilliseconds: Flag.Finite("max-delay").pipe(
      Flag.withSchema(NonNegativeNumberSchema),
      Flag.withDefault(10_000),
      Flag.withDescription("Longest wait between two replayed lines."),
    ),
    outputFilePath: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription(
        "Where to write the replayed log (e.g. the Fellowship log directory).",
      ),
    ),
    speed: Flag.Finite("speed").pipe(
      Flag.withAlias("s"),
      Flag.withSchema(PositiveNumberSchema),
      Flag.withDefault(1),
      Flag.withDescription("Replay speed multiplier."),
    ),
  },
  replayFellowshipLogFile,
).pipe(
  Command.withDescription(
    "Replay a combat log in real time with timestamps starting now, to test tracking without playing.",
  ),
);
