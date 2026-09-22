import * as Data from "effect/Data";

import { type ConfigurationId } from "@frt/shared/validation/configuration/configuration-id-schema.ts";

export class FellowshipTrackerAlreadyRunningError extends Data.TaggedError(
  "FellowshipTrackerAlreadyRunningError",
) {
  override get message() {
    return "Fellowship tracker is already running.";
  }
}

export class FellowshipTrackerConfigurationNotFoundError extends Data.TaggedError(
  "FellowshipTrackerConfigurationNotFoundError",
)<{
  readonly configurationId: ConfigurationId;
}> {
  override get message() {
    return `Configuration not found: ${this.configurationId}.`;
  }
}
