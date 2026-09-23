import * as Schema from "effect/Schema";

export const BackgroundJobStatusSchema = Schema.Literals([
  "FAILED",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
]);

export type BackgroundJobStatus = typeof BackgroundJobStatusSchema.Type;
