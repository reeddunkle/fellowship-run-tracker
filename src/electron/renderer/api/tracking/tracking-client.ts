import * as E from "effect/Effect";

import { type StartTrackingApiRequest } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";

export function getTracking() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.tracking.getTracking();
  });
}

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
