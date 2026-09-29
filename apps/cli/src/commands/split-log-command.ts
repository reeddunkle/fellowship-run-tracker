import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as E from "effect/Effect";

import { splitFellowshipLogFile } from "@frt/api/services/fellowship/utilities/split-fellowship-log-file.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

type SplitLogCommandInput = {
  readonly inputFilePath: string;
  readonly outputDirectoryPath: string;
};

const runSplitLogCommand = E.fn("runSplitLogCommand")(function* (
  input: SplitLogCommandInput,
) {
  const result = yield* splitFellowshipLogFile({
    inputFilePath: input.inputFilePath,
    outputDirectoryPath: input.outputDirectoryPath,
  });

  yield* E.logInfo("Split Fellowship log completed.", {
    attemptCount: result.attemptCount,
    totalLineCount: result.totalLineCount,
  });
});

export const splitLogCommand = Command.make(
  "split-log",
  {
    inputFilePath: Flag.String("log").pipe(
      Flag.withAlias("l"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Fellowship combat log to split."),
    ),
    outputDirectoryPath: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Directory to write one log per dungeon attempt."),
    ),
  },
  runSplitLogCommand,
).pipe(
  Command.withDescription(
    "Split a combat log into one file per dungeon attempt.",
  ),
);
