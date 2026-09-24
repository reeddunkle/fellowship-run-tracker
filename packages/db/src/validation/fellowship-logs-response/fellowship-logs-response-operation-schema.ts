import * as Schema from "effect/Schema";

export const FellowshipLogsResponseOperationSchema = Schema.Literals([
  "DUNGEON_RUN_METADATA",
  "FIGHT",
  "REPORT_PAGE",
]);

export type FellowshipLogsResponseOperation =
  typeof FellowshipLogsResponseOperationSchema.Type;
