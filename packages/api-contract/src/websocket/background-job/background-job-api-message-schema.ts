import * as Schema from "effect/Schema";

import { BackgroundJobApiSnapshotSchema } from "@frt/shared/background-job/background-job-api-schema.ts";

export const BackgroundJobApiMessageSchema = Schema.Struct({
  snapshot: BackgroundJobApiSnapshotSchema,
  version: Schema.Literal(1),
});

export type BackgroundJobApiMessage = typeof BackgroundJobApiMessageSchema.Type;
