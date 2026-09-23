import * as Schema from "effect/Schema";

export const BackgroundJobIdSchema = Schema.String.pipe(
  Schema.brand("BackgroundJobId"),
);

export type BackgroundJobId = typeof BackgroundJobIdSchema.Type;
