import * as Schema from "effect/Schema";

import {
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
  TrackingApiStartError,
} from "@frt/api-contract/errors/tracking-api-error.ts";

const START_FAILED_MESSAGE = "Tracking could not be started.";
const STOP_FAILED_MESSAGE = "Tracking could not be stopped.";

const isTrackingApiStartFailure = Schema.is(
  Schema.Union([
    TrackingApiAlreadyRunningError,
    TrackingApiConfigurationNotFoundError,
    TrackingApiStartError,
  ]),
);

type GetTrackingActionErrorMessageOptions = {
  readonly isTrackingActive: boolean;
  readonly startError: unknown;
  readonly stopError: unknown;
};

export function getTrackingActionErrorMessage({
  isTrackingActive,
  startError,
  stopError,
}: GetTrackingActionErrorMessageOptions): string | undefined {
  if (!isTrackingActive && startError !== undefined) {
    return isTrackingApiStartFailure(startError)
      ? startError.message
      : START_FAILED_MESSAGE;
  }

  if (isTrackingActive && stopError !== undefined) {
    return STOP_FAILED_MESSAGE;
  }

  return undefined;
}
