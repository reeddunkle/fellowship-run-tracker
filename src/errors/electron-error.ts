import * as Data from "effect/Data";

import { type AppStateRpcRequest } from "@/services/api/app-state/app-state-rpc.ts";

export class FilesClientError extends Data.TaggedError("FilesClientError")<{
  readonly cause: unknown;
  readonly operation: "GetDirectoryPath";
}> {}

export class AppStateClientError extends Data.TaggedError(
  "AppStateClientError",
)<{
  readonly cause: unknown;
  readonly operation: AppStateRpcRequest["_tag"];
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
