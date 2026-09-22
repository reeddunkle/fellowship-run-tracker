import * as E from "effect/Effect";

import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

type EncounterIdArgs = {
  readonly dungeonId: DungeonId;
  readonly id: string;
};

export function getEncounters() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.encounters.getEncounters();
  });
}

export function getEncounter({ dungeonId, id }: EncounterIdArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.encounters.getEncounter({
      params: {
        dungeonId,
        id,
      },
    });
  });
}
