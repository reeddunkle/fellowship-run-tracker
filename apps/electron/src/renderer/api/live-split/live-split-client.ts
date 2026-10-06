import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export const connectLiveSplit = E.fn("connectLiveSplit")(function* () {
  const client = yield* AppApiClient;

  return yield* client.liveSplit.connectLiveSplit();
});

export const disconnectLiveSplit = E.fn("disconnectLiveSplit")(function* () {
  const client = yield* AppApiClient;

  return yield* client.liveSplit.disconnectLiveSplit();
});
