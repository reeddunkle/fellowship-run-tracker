import * as Data from "effect/Data";

export class RouterInvalidationError extends Data.TaggedError(
  "RouterInvalidationError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to invalidate the router.";
  }
}
