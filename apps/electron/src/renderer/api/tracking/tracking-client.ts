import * as E from "effect/Effect";

import { type StartTrackingApiRequest } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export const startTracking = E.fn("startTracking")(function* (
  request: StartTrackingApiRequest,
) {
  const client = yield* AppApiClient;

  return yield* client.tracking.startTracking({
    payload: request,
  });
});

export const stopTracking = E.fn("stopTracking")(function* () {
  const client = yield* AppApiClient;

  return yield* client.tracking.stopTracking();
});
