import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";

type AbilityIdArgs = {
  readonly id: string;
};

export function getAbilities() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.abilities.getAbilities();
  });
}

export function getAbility({ id }: AbilityIdArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.abilities.getAbility({
      params: {
        id,
      },
    });
  });
}
