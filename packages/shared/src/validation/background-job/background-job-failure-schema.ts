import * as Schema from "effect/Schema";

/*
 * A serializable summary of why a background job failed. The tag lets the
 * renderer pick a specific message for known failures.
 */
export const BackgroundJobFailureSchema = Schema.Struct({
  message: Schema.String,
  tag: Schema.String,
});

export type BackgroundJobFailure = typeof BackgroundJobFailureSchema.Type;
