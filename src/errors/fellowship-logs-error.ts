import * as Data from "effect/Data";

import { type FellowshipLogsGraphQLError } from "@/services/fellowship-logs/validation/fellowship-logs-graphql-schema.ts";

export class FellowshipLogsRequestError extends Data.TaggedError(
  "FellowshipLogsRequestError",
)<{
  readonly cause: unknown;
  readonly operation: "GetAccessToken" | "Query" | "ReadFixture";
}> {}

export class FellowshipLogsGraphQLResponseError extends Data.TaggedError(
  "FellowshipLogsGraphQLResponseError",
)<{
  readonly errors: ReadonlyArray<FellowshipLogsGraphQLError>;
  readonly message: string;
}> {}

export class FellowshipLogsEventDecodeError extends Data.TaggedError(
  "FellowshipLogsEventDecodeError",
)<{
  cause: unknown;
}> {}
