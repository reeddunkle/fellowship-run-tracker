import { createFileRoute } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { getConfigurations } from "@/electron/renderer/api/configuration/configuration-client";
import { HomePage } from "@/electron/renderer/components/home/home-page";
import { FellowshipCatalogDataService } from "@/electron/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service";

function HomeRoute() {
  const { abilities, configurations, dungeons, encounters, units } =
    Route.useLoaderData();

  return (
    <HomePage
      abilities={abilities}
      configurations={configurations}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    />
  );
}

export const Route = createFileRoute("/")({
  component: HomeRoute,
  loader: ({ context }) => {
    return context.browserRuntime.runPromise(
      E.gen(function* () {
        const fellowshipCatalogDataService =
          yield* FellowshipCatalogDataService;

        const [fellowshipCatalogData, configurations] = yield* E.all([
          fellowshipCatalogDataService.get,
          getConfigurations(),
        ]);

        return {
          ...fellowshipCatalogData,
          configurations,
        };
      }),
    );
  },
});
