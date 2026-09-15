import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";

type UnitIdArgs = {
  readonly id: string;
};

export function getUnits() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.units.getUnits();
  });
}

export function getUnit({ id }: UnitIdArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.units.getUnit({
      params: {
        id,
      },
    });
  });
}
