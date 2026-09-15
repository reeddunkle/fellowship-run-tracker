import * as Data from "effect/Data";

export class QueryClientOperationError extends Data.TaggedError(
  "QueryClientOperationError",
)<{
  readonly cause: unknown;
  readonly operation: "CANCEL_QUERIES" | "INVALIDATE_QUERIES" | "QUERY";
}> {}
