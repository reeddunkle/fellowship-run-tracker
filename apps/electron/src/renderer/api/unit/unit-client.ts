import * as E from "effect/Effect";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

type UnitIdArgs = {
  readonly id: string;
};

export const getUnits = E.fn("UnitApiClient.getUnits")(function* () {
  const client = yield* AppApiClient;

  return yield* client.units.getUnits();
});

export const getUnit = E.fn("UnitApiClient.getUnit")(function* ({
  id,
}: UnitIdArgs) {
  const client = yield* AppApiClient;

  return yield* client.units.getUnit({
    params: {
      id,
    },
  });
});
