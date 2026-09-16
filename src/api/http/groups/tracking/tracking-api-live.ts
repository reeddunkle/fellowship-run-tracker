import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { createTrackingApiStatus } from "@/application/fellowship-tracker/create-tracking-api-status.ts";
import {
  FellowshipTracker,
  type FellowshipTrackerStartError,
} from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  FellowshipTrackerAlreadyRunningError,
  FellowshipTrackerConfigurationNotFoundError,
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
  TrackingApiStartError,
} from "@/errors/fellowship-tracker-error.ts";

function mapFellowshipTrackerStartError(
  error: FellowshipTrackerStartError,
): E.Effect<
  never,
  | TrackingApiAlreadyRunningError
  | TrackingApiConfigurationNotFoundError
  | TrackingApiStartError
> {
  if (error instanceof FellowshipTrackerAlreadyRunningError) {
    return E.fail(
      new TrackingApiAlreadyRunningError({
        message: "Tracking is already running.",
      }),
    );
  }

  if (error instanceof FellowshipTrackerConfigurationNotFoundError) {
    return E.fail(
      new TrackingApiConfigurationNotFoundError({
        configurationId: error.configurationId,
        message: "The selected configuration could not be found.",
      }),
    );
  }

  return E.gen(function* () {
    yield* E.logError("Fellowship tracker failed to start.", {
      error,
    });

    return yield* new TrackingApiStartError({
      message: "Tracking could not be started.",
    });
  });
}

const TrackingApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "tracking",
  E.fn(function* (handlers) {
    const fellowshipTracker = yield* FellowshipTracker;

    return handlers
      .handle("getTracking", () => {
        return fellowshipTracker.status.pipe(E.map(createTrackingApiStatus));
      })
      .handle("startTracking", ({ payload }) => {
        return E.gen(function* () {
          yield* fellowshipTracker
            .start({
              configurationId: payload.configurationId,
            })
            .pipe(E.catch(mapFellowshipTrackerStartError));

          const status = yield* fellowshipTracker.status;

          return createTrackingApiStatus(status);
        });
      })
      .handle("stopTracking", () => {
        return E.gen(function* () {
          yield* fellowshipTracker.stop();

          const status = yield* fellowshipTracker.status;

          return createTrackingApiStatus(status);
        });
      });
  }),
);

export const TrackingApiLive: Layer.Layer<
  Layer.Success<typeof TrackingApiHandlersInferred>,
  Layer.Error<typeof TrackingApiHandlersInferred>,
  FellowshipTracker
> = TrackingApiHandlersInferred;
