import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export function connectLiveSplit() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.liveSplit.connectLiveSplit();
  });
}

export function disconnectLiveSplit() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.liveSplit.disconnectLiveSplit();
  });
}
