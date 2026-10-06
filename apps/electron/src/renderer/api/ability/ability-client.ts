import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

type AbilityIdArgs = {
  readonly id: string;
};

export function getAbilities() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.abilities.getAbilities();
  });
}

export const getAbility = E.fn("getAbility")(function* ({ id }: AbilityIdArgs) {
  const client = yield* AppApiClient;

  return yield* client.abilities.getAbility({
    params: {
      id,
    },
  });
});
