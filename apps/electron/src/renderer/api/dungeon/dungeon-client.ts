import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export function getDungeons() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.dungeons.getDungeons();
  });
}
