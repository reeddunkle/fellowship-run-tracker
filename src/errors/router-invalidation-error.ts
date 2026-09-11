import * as Data from "effect/Data";

export class RouterInvalidationError extends Data.TaggedError(
  "RouterInvalidationError",
)<{
  readonly cause: unknown;
}> {}
