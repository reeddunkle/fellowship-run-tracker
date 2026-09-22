import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { getAbilities } from "@/renderer/api/ability/ability-client.ts";
import { getDungeons } from "@/renderer/api/dungeon/dungeon-client.ts";
import { getEncounters } from "@/renderer/api/encounter/encounter-client.ts";
import { getUnits } from "@/renderer/api/unit/unit-client.ts";
import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

const getFellowshipCatalogData = E.all({
  abilities: getAbilities(),
  dungeons: getDungeons(),
  encounters: getEncounters(),
  units: getUnits(),
});

type FellowshipCatalogData = E.Success<typeof getFellowshipCatalogData>;

export type FellowshipCatalogDataShape = {
  readonly get: E.Effect<
    FellowshipCatalogData,
    E.Error<typeof getFellowshipCatalogData>
  >;
};

export class FellowshipCatalogDataService extends Context.Service<
  FellowshipCatalogDataService,
  FellowshipCatalogDataShape
>()(
  "@frt/electron/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service/FellowshipCatalogDataService",
) {}

const makeFellowshipCatalogDataService = E.gen(function* () {
  const appApiClient = yield* AppApiClient;

  const get = yield* E.cached(
    getFellowshipCatalogData.pipe(E.provideService(AppApiClient, appApiClient)),
  );

  return {
    get,
  } satisfies FellowshipCatalogDataShape;
});

export const FellowshipCatalogDataServiceLayer = Layer.effect(
  FellowshipCatalogDataService,
  makeFellowshipCatalogDataService,
);
