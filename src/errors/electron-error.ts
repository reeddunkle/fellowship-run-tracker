import * as Data from "effect/Data";

export class FilesClientError extends Data.TaggedError("FilesClientError")<{
  readonly cause: unknown;
  readonly operation: "GetDirectoryPath";
}> {}

export class AppStateClientError extends Data.TaggedError(
  "AppStateClientError",
)<{
  readonly cause: unknown;
  readonly operation: "Get" | "Set";
}> {}

export class WindowClientError extends Data.TaggedError("WindowClientError")<{
  readonly cause: unknown;
  readonly operation: "ResizeToContent";
}> {}

export class ElectronApplicationShutdownError extends Data.TaggedError(
  "ElectronApplicationShutdownError",
)<{
  readonly cause: unknown;
}> {}

export class ElectronWindowCreationError extends Data.TaggedError(
  "ElectronWindowCreationError",
)<{
  readonly cause: unknown;
}> {}
