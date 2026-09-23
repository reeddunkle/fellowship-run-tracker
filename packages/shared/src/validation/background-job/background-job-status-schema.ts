import * as Schema from "effect/Schema";

export const BackgroundJobStatusSchema = Schema.Literals([
  "FAILED",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "WAITING",
]);

export type BackgroundJobStatus = typeof BackgroundJobStatusSchema.Type;
