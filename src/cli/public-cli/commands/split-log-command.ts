import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { splitFellowshipLogFile } from "@/services/fellowship/utilities/split-fellowship-log-file.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const SplitLogCommandInputSchema = Schema.Struct({
  inputFilePath: NonEmptyStringSchema,
  outputDirectoryPath: NonEmptyStringSchema,
});

export type SplitLogCommandInput = typeof SplitLogCommandInputSchema.Type;

export const runSplitLogCommand = E.fn("cli.split-log")(function* (
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

  return result;
});
