import * as Data from "effect/Data";

export class UnexpectedDatabaseError extends Data.TaggedError(
  "UnexpectedDatabaseError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Unexpected database error.";
  }
}
