import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { filterFellowshipLogFile } from "@/services/fellowship/utilities/filter-fellowship-log-file.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const FilterLogCommandInputSchema = Schema.Struct({
  inputFilePath: NonEmptyStringSchema,
  outputFilePath: NonEmptyStringSchema,
});

export type FilterLogCommandInput = typeof FilterLogCommandInputSchema.Type;

export const runFilterLogCommand = E.fn("cli.filter-log")(function* (
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

  return result;
});
