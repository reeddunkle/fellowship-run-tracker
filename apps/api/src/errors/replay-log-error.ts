import * as Data from "effect/Data";

export class ReplayLogFilePathConflictError extends Data.TaggedError(
  "ReplayLogFilePathConflictError",
)<{
  readonly inputFilePath: string;
  readonly outputFilePath: string;
}> {
  override get message() {
    return `The replay output file can't be the input file: ${this.inputFilePath}.`;
  }
}

export class ReplayLogFileEmptyInputError extends Data.TaggedError(
  "ReplayLogFileEmptyInputError",
)<{
  readonly inputFilePath: string;
}> {
  override get message() {
    return `The replay input file is empty: ${this.inputFilePath}.`;
  }
}
