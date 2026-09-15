import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";

export function getLiveSplitConnection() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.liveSplit.getLiveSplitConnection();
  });
}

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
