import * as E from "effect/Effect";

import { type StartTrackingApiRequest } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export function startTracking(request: StartTrackingApiRequest) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.tracking.startTracking({
      payload: request,
    });
  });
}

export function stopTracking() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.tracking.stopTracking();
  });
}
