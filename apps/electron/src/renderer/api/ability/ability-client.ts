import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

type AbilityIdArgs = {
  readonly id: string;
};

export const getAbilities = E.fn("AbilityApiClient.getAbilities")(function* () {
  const client = yield* AppApiClient;

  return yield* client.abilities.getAbilities();
});

export const getAbility = E.fn("AbilityApiClient.getAbility")(function* ({
  id,
}: AbilityIdArgs) {
  const client = yield* AppApiClient;

  return yield* client.abilities.getAbility({
    params: {
      id,
    },
  });
});
