import * as Data from "effect/Data";

const FILE_NOT_FOUND_ERROR = "FileNotFoundError" as const;

export class FileNotFoundError extends Data.TaggedError(FILE_NOT_FOUND_ERROR)<{
  readonly directoryPath: string;
}> {}
