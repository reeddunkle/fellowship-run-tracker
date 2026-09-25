import * as Schema from "effect/Schema";

import { FellowshipLogsResponseOperationSchema } from "@frt/db/validation/fellowship-logs-response/fellowship-logs-response-operation-schema.ts";

const FellowshipLogsRequestOperationSchema = Schema.Literals([
  ...FellowshipLogsResponseOperationSchema.literals,
  "RATE_LIMIT_DATA",
]);

export type FellowshipLogsRequestOperation =
  typeof FellowshipLogsRequestOperationSchema.Type;

const FellowshipLogsRequestSourceSchema = Schema.Literals(["API", "CACHE"]);

export type FellowshipLogsRequestSource =
  typeof FellowshipLogsRequestSourceSchema.Type;
