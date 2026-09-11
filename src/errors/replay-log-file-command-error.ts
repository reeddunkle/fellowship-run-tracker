import * as Data from "effect/Data";

export class ReplayLogFilePathConflictError extends Data.TaggedError(
  "ReplayLogFilePathConflictError",
)<{
  readonly inputFilePath: string;
  readonly outputFilePath: string;
}> {}

export class ReplayLogFileEmptyInputError extends Data.TaggedError(
  "ReplayLogFileEmptyInputError",
)<{
  readonly inputFilePath: string;
}> {}
