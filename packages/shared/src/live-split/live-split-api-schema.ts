import * as Schema from "effect/Schema";

const DisconnectedLiveSplitApiStatusSchema = Schema.Struct({
  status: Schema.Literal("Disconnected"),
});

const ConnectedLiveSplitApiStatusSchema = Schema.Struct({
  status: Schema.Literal("Connected"),
});

export const LiveSplitApiStatusSchema = Schema.Union([
  DisconnectedLiveSplitApiStatusSchema,
  ConnectedLiveSplitApiStatusSchema,
]);

export type LiveSplitApiStatus = typeof LiveSplitApiStatusSchema.Type;
