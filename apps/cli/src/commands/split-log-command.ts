import * as E from "effect/Effect";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";

import { splitFellowshipLogFile } from "@frt/api/services/fellowship/utilities/split-fellowship-log-file.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

type SplitLogCommandInput = {
  readonly inputFilePath: string;
  readonly outputDirectoryPath: string;
};

const runSplitLogCommand = E.fn("cli.split-log")(function* (
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
    inputFilePath: Flag.string("log").pipe(
      Flag.withAlias("l"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Fellowship combat log to split."),
    ),
    outputDirectoryPath: Flag.string("output").pipe(
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
