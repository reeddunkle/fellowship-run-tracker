import { createFileRoute } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import { HomePage } from "@/electron/renderer/components/home/home-page";
import { FellowshipCatalogDataService } from "@/electron/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";

function HomeRoute() {
  const { abilities, dungeons, encounters, units } = Route.useLoaderData();

  return (
    <HomePage
      abilities={abilities}
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

        const result = yield* E.all({
          configurations: E.tryPromise({
            catch: (cause) => {
              return new QueryClientOperationError({
                cause,
                operation: "QUERY",
              });
            },
            try: () => {
              return context.queryClient.query({
                ...getConfigurationsQueryOptions(),
                staleTime: "static",
              });
            },
          }),
          fellowshipCatalogData: fellowshipCatalogDataService.get,
        });

        return result.fellowshipCatalogData;
      }),
    );
  },
});
