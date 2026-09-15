import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

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
