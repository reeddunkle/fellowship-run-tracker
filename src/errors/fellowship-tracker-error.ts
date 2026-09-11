import * as Data from "effect/Data";
import * as Schema from "effect/Schema";

import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

const FELLOWSHIP_TRACKER_ALREADY_RUNNING_ERROR =
  "FellowshipTrackerAlreadyRunningError" as const;

export class FellowshipTrackerAlreadyRunningError extends Data.TaggedError(
  FELLOWSHIP_TRACKER_ALREADY_RUNNING_ERROR,
)<Record<never, never>> {
  override get message(): string {
    return "Fellowship tracker is already running.";
  }
}

const FELLOWSHIP_TRACKER_CONFIGURATION_NOT_FOUND_ERROR =
  "FellowshipTrackerConfigurationNotFoundError" as const;

export class FellowshipTrackerConfigurationNotFoundError extends Data.TaggedError(
  FELLOWSHIP_TRACKER_CONFIGURATION_NOT_FOUND_ERROR,
)<{
  readonly configurationId: ConfigurationId;
}> {
  constructor(configurationId: ConfigurationId) {
    super({
      configurationId,
    });
  }

  override get message(): string {
    return `Configuration not found: ${this.configurationId}`;
  }
}

const TRACKING_API_ALREADY_RUNNING_ERROR =
  "TrackingApiAlreadyRunningError" as const;

export class TrackingApiAlreadyRunningError extends Data.TaggedError(
  TRACKING_API_ALREADY_RUNNING_ERROR,
)<{
  readonly message: string;
}> {}

export const TrackingApiAlreadyRunningErrorSchema = Schema.Struct({
  _tag: Schema.Literal(TRACKING_API_ALREADY_RUNNING_ERROR),
  message: Schema.String,
});

const TRACKING_API_CONFIGURATION_NOT_FOUND_ERROR =
  "TrackingApiConfigurationNotFoundError" as const;

export class TrackingApiConfigurationNotFoundError extends Data.TaggedError(
  TRACKING_API_CONFIGURATION_NOT_FOUND_ERROR,
)<{
  readonly configurationId: ConfigurationId;
  readonly message: string;
}> {}

export const TrackingApiConfigurationNotFoundErrorSchema = Schema.Struct({
  _tag: Schema.Literal(TRACKING_API_CONFIGURATION_NOT_FOUND_ERROR),
  configurationId: Schema.String,
  message: Schema.String,
});

const TRACKING_API_START_ERROR = "TrackingApiStartError" as const;

export class TrackingApiStartError extends Data.TaggedError(
  TRACKING_API_START_ERROR,
)<{
  readonly message: string;
}> {}

export const TrackingApiStartErrorSchema = Schema.Struct({
  _tag: Schema.Literal(TRACKING_API_START_ERROR),
  message: Schema.String,
});
