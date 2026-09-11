import * as Schema from "effect/Schema";

import { LiveSplitApiStatusSchema } from "@/services/api/live-split/live-split-api-schema.ts";

export const LiveSplitApiMessageSchema = Schema.Struct({
  status: LiveSplitApiStatusSchema,
  version: Schema.Literal(1),
});

export type LiveSplitApiMessage = typeof LiveSplitApiMessageSchema.Type;
