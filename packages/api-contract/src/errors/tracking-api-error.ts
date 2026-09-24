import * as Schema from "effect/Schema";

import { ConfigurationIdSchema } from "@frt/shared/configuration/configuration-id-schema.ts";

export class TrackingApiAlreadyRunningError extends Schema.TaggedError<TrackingApiAlreadyRunningError>()(
  "TrackingApiAlreadyRunningError",
  {},
  { httpApiStatus: 409 },
) {
  override get message() {
    return "Tracking is already running.";
  }
}

export class TrackingApiConfigurationNotFoundError extends Schema.TaggedError<TrackingApiConfigurationNotFoundError>()(
  "TrackingApiConfigurationNotFoundError",
  {
    configurationId: ConfigurationIdSchema,
  },
  { httpApiStatus: 404 },
) {
  override get message() {
    return "The selected configuration could not be found.";
  }
}

export class TrackingApiStartError extends Schema.TaggedError<TrackingApiStartError>()(
  "TrackingApiStartError",
  {},
  { httpApiStatus: 500 },
) {
  override get message() {
    return "Tracking could not be started.";
  }
}
