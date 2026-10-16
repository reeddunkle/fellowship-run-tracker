import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

export const connectLiveSplit = E.fn("LiveSplitApiClient.connectLiveSplit")(
  function* () {
    const client = yield* AppApiClient;

    return yield* client.liveSplit.connectLiveSplit();
  },
);

export const disconnectLiveSplit = E.fn(
  "LiveSplitApiClient.disconnectLiveSplit",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.liveSplit.disconnectLiveSplit();
});
