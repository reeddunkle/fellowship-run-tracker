import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as E from "effect/Effect";

import { filterFellowshipLogFile } from "@frt/api/services/fellowship/utilities/filter-fellowship-log-file.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

type FilterLogCommandInput = {
  readonly inputFilePath: string;
  readonly outputFilePath: string;
};

const runFilterLogCommand = E.fn("runFilterLogCommand")(function* (
  input: FilterLogCommandInput,
) {
  const result = yield* filterFellowshipLogFile({
    inputFilePath: input.inputFilePath,
    outputFilePath: input.outputFilePath,
  });

  yield* E.logInfo(`Filtered log written to ${input.outputFilePath}.`, {
    inputFilePath: input.inputFilePath,
    outputFilePath: input.outputFilePath,
    removedLineCount: result.totalLineCount - result.retainedLineCount,
    retainedLineCount: result.retainedLineCount,
    totalLineCount: result.totalLineCount,
  });
});

export const filterLogCommand = Command.make(
  "filter-log",
  {
    inputFilePath: Flag.String("log").pipe(
      Flag.withAlias("l"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Fellowship combat log to filter."),
    ),
    outputFilePath: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("Where to write the filtered log."),
    ),
  },
  runFilterLogCommand,
).pipe(
  Command.withDescription(
    "Write a copy of a combat log keeping only the lines the tracker uses.",
  ),
);
