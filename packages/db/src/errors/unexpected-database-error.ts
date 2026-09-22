import * as Data from "effect/Data";

/**
 * Catch-all DAO error reason for failures without a more specific reason (e.g.
 * `SqlError`, `SchemaError`), which are kept as the `cause`.
 */
export class UnexpectedDatabaseError extends Data.TaggedError(
  "UnexpectedDatabaseError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Unexpected database error.";
  }
}
