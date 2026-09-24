import * as Schema from "effect/Schema";

import { ConfigurationIdSchema } from "@frt/shared/configuration/configuration-id-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";

export const StartTrackingApiRequestSchema = Schema.Struct({
  configurationId: ConfigurationIdSchema,
});

export type StartTrackingApiRequest = typeof StartTrackingApiRequestSchema.Type;

const PersistedTrackingApiSourceSchema = Schema.Struct({
  configurationId: ConfigurationIdSchema,
  type: Schema.Literal("Persisted"),
});

const ExternalTrackingApiSourceSchema = Schema.Struct({
  type: Schema.Literal("External"),
});

const TrackingApiSourceSchema = Schema.Union([
  PersistedTrackingApiSourceSchema,
  ExternalTrackingApiSourceSchema,
]);

export type TrackingApiSource = typeof TrackingApiSourceSchema.Type;

const ConfigurationTrackingApiFailureSchema = Schema.Struct({
  type: Schema.Literal("Configuration"),
});

const FileSystemTrackingApiFailureSchema = Schema.Struct({
  type: Schema.Literal("FileSystem"),
});

const UnexpectedTrackingApiFailureSchema = Schema.Struct({
  type: Schema.Literal("Unexpected"),
});

const TrackingApiFailureSchema = Schema.Union([
  ConfigurationTrackingApiFailureSchema,
  FileSystemTrackingApiFailureSchema,
  UnexpectedTrackingApiFailureSchema,
]);

export type TrackingApiFailure = typeof TrackingApiFailureSchema.Type;

const IdleTrackingApiStatusSchema = Schema.Struct({
  status: Schema.Literal("Idle"),
});

const WaitingForLogFileTrackingApiStatusSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  source: TrackingApiSourceSchema,
  status: Schema.Literal("WaitingForLogFile"),
});

const ActiveTrackingApiStatusSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  source: TrackingApiSourceSchema,
  status: Schema.Literal("Tracking"),
});

const FailedTrackingApiStatusSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  failure: TrackingApiFailureSchema,
  source: TrackingApiSourceSchema,
  status: Schema.Literal("Failed"),
});

export const TrackingApiStatusSchema = Schema.Union([
  IdleTrackingApiStatusSchema,
  WaitingForLogFileTrackingApiStatusSchema,
  ActiveTrackingApiStatusSchema,
  FailedTrackingApiStatusSchema,
]);

export type TrackingApiStatus = typeof TrackingApiStatusSchema.Type;
