import * as Schema from "effect/Schema";

export const BackgroundJobFailureSchema = Schema.Struct({
  message: Schema.String,
  tag: Schema.String,
});

export type BackgroundJobFailure = typeof BackgroundJobFailureSchema.Type;
