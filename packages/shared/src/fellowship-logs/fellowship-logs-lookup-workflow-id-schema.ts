import * as Schema from "effect/Schema";

export const FellowshipLogsLookupWorkflowIdSchema = Schema.String.check(
  Schema.isUUID(4),
).pipe(Schema.brand("FellowshipLogsLookupWorkflowId"));

export type FellowshipLogsLookupWorkflowId =
  typeof FellowshipLogsLookupWorkflowIdSchema.Type;
