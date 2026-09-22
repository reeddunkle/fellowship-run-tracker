import * as E from "effect/Effect";

import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

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
