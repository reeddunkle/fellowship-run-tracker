import * as Data from "effect/Data";

const QUERY_CLIENT_OPERATION_DESCRIPTIONS = {
  CancelQueries: "cancel queries",
  InvalidateQueries: "invalidate queries",
  Query: "run a query",
} as const;

export class QueryClientOperationError extends Data.TaggedError(
  "QueryClientOperationError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof QUERY_CLIENT_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Query client failed to ${QUERY_CLIENT_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}
