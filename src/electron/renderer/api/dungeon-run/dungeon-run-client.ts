import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

type DungeonRunHistoryArgs = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
};

export function deleteDungeonRunHistory({
  dungeonId,
  dungeonLevel,
}: DungeonRunHistoryArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.dungeonRun.deleteDungeonRunHistory({
      params: {
        dungeonId,
        dungeonLevel,
      },
    });
  });
}

export function getDungeonRunHistory({
  dungeonId,
  dungeonLevel,
}: DungeonRunHistoryArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.dungeonRun.getDungeonRunHistory({
      params: {
        dungeonId,
        dungeonLevel,
      },
    });
  });
}
