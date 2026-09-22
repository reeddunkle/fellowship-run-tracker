import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { createTrackingApiStatus } from "@frt/api/application/fellowship-tracker/create-tracking-api-status.ts";
import {
  FellowshipTracker,
  type FellowshipTrackerStartError,
} from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
  TrackingApiStartError,
} from "@frt/api-contract/errors/tracking-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function mapFellowshipTrackerStartError(
  error: FellowshipTrackerStartError,
): E.Effect<
  never,
  | TrackingApiAlreadyRunningError
  | TrackingApiConfigurationNotFoundError
  | TrackingApiStartError
> {
  if (error._tag === "FellowshipTrackerAlreadyRunningError") {
    return E.fail(new TrackingApiAlreadyRunningError());
  }

  if (error._tag === "FellowshipTrackerConfigurationNotFoundError") {
    return E.fail(
      new TrackingApiConfigurationNotFoundError({
        configurationId: error.configurationId,
      }),
    );
  }

  return E.gen(function* () {
    yield* E.logError("Fellowship tracker failed to start.", {
      error,
    });

    return yield* new TrackingApiStartError();
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

export const TrackingApiLayer: Layer.Layer<
  Layer.Success<typeof TrackingApiHandlersInferred>,
  Layer.Error<typeof TrackingApiHandlersInferred>,
  FellowshipTracker
> = TrackingApiHandlersInferred;
