import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

type EncounterIdArgs = {
  readonly dungeonId: DungeonId;
  readonly id: string;
};

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

export function getEncountersBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.encounters.getEncounters();
    });
  };
}

export function getEncounterBase(baseUrl: string) {
  return ({ dungeonId, id }: EncounterIdArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.encounters.getEncounter({
        params: {
          dungeonId,
          id,
        },
      });
    });
  };
}

export function getEncounters() {
  return getEncountersBase(getApiBaseUrl())();
}

// function getEncounter(args: EncounterIdArgs) {
//   return getEncounterBase(getApiBaseUrl())(args);
// }
