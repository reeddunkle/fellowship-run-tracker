import * as Schema from "effect/Schema";

const RendererLogLevelSchema = Schema.Literals(["Warn", "Error", "Fatal"]);

export type RendererLogLevel = typeof RendererLogLevelSchema.Type;

export const RendererLogEntrySchema = Schema.Struct({
  annotations: Schema.Record(Schema.String, Schema.Unknown),
  cause: Schema.NullOr(Schema.String),
  level: RendererLogLevelSchema,
  message: Schema.String,
});

export type RendererLogEntry = typeof RendererLogEntrySchema.Type;
