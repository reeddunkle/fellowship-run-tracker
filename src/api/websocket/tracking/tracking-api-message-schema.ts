import * as Schema from "effect/Schema";

import { TrackingApiStatusSchema } from "@/application/fellowship-tracker/tracking-api-schema.ts";

export const TrackingApiMessageSchema = Schema.Struct({
  status: TrackingApiStatusSchema,
  version: Schema.Literal(1),
});

export type TrackingApiMessage = typeof TrackingApiMessageSchema.Type;
