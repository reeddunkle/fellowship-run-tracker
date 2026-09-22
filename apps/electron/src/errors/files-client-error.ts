import * as Data from "effect/Data";

const FILES_CLIENT_OPERATION_DESCRIPTIONS = {
  GetDirectoryPath: "choose a directory",
} as const;

export class FilesClientError extends Data.TaggedError("FilesClientError")<{
  readonly cause: unknown;
  readonly operation: keyof typeof FILES_CLIENT_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${FILES_CLIENT_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}
