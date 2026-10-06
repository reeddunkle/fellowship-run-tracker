import * as E from "effect/Effect";

import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

type DungeonRunHistoryArgs = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
};

export const deleteDungeonRunHistory = E.fn("deleteDungeonRunHistory")(
  function* ({ dungeonId, dungeonLevel }: DungeonRunHistoryArgs) {
    const client = yield* AppApiClient;

    yield* client.dungeonRun.deleteDungeonRunHistory({
      params: {
        dungeonId,
        dungeonLevel,
      },
    });
  },
);

export const getDungeonRunHistory = E.fn("getDungeonRunHistory")(function* ({
  dungeonId,
  dungeonLevel,
}: DungeonRunHistoryArgs) {
  const client = yield* AppApiClient;

  return yield* client.dungeonRun.getDungeonRunHistory({
    params: {
      dungeonId,
      dungeonLevel,
    },
  });
});
