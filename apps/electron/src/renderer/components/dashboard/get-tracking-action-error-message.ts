import * as Schema from "effect/Schema";

import {
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
  TrackingApiStartError,
} from "@frt/api-contract/errors/tracking-api-error.ts";

const START_FAILED_MESSAGE = "Tracking could not be started.";
const STOP_FAILED_MESSAGE = "Tracking could not be stopped.";

/** The errors the start tracking endpoint declares. */
const isTrackingApiStartFailure = Schema.is(
  Schema.Union([
    TrackingApiAlreadyRunningError,
    TrackingApiConfigurationNotFoundError,
    TrackingApiStartError,
  ]),
);

type GetTrackingActionErrorMessageOptions = {
  /** Tracking is running or waiting for a log file. */
  readonly isTrackingActive: boolean;
  readonly startError: unknown;
  readonly stopError: unknown;
};

/**
 * The message for a start or stop attempt that failed, while it's still
 * relevant: a failed start until tracking is running, a failed stop while it
 * still is. The API's own errors carry a message for the user; anything else
 * (e.g. the API server being unreachable) gets a general one.
 */
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
