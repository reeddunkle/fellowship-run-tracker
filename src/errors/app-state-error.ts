import * as Data from "effect/Data";

export class AppStateInitializationError extends Data.TaggedError(
  "AppStateInitializationError",
)<{
  readonly cause: unknown;
}> {}
