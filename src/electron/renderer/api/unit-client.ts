import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";

type UnitIdArgs = {
  readonly id: string;
};

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

export function getUnitsBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.units.getUnits();
    });
  };
}

export function getUnitBase(baseUrl: string) {
  return ({ id }: UnitIdArgs) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.units.getUnit({
        params: {
          id,
        },
      });
    });
  };
}

export function getUnits() {
  return getUnitsBase(getApiBaseUrl())();
}
