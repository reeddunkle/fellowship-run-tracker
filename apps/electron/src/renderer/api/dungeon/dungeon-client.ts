import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

export const getDungeons = E.fn("DungeonApiClient.getDungeons")(function* () {
  const client = yield* AppApiClient;

  return yield* client.dungeons.getDungeons();
});
