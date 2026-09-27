import { createRootRouteWithContext } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { API_CONTRACT_VERSION } from "@frt/api-contract/constants/api-contract-version.ts";

import { ApiContractVersionError } from "@/errors/api-contract-version-error.ts";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import { getAppSettings } from "@/renderer/api/app-settings/app-settings-client.ts";
import { getConfigurationsQueryOptions } from "@/renderer/api/configuration/configuration-queries.ts";
import { getMetaQueryOptions } from "@/renderer/api/meta/meta-queries.ts";
import { RootLayout } from "@/renderer/components/core/root-layout";
import { type RouterContext } from "@/renderer/router/router-context";
import { FellowshipCatalogData } from "@/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service.ts";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  loader: ({ context }) => {
    return context.browserRuntime.runPromise(
      E.gen(function* () {
        const meta = yield* E.tryPromise({
          catch: (cause) => {
            return new QueryClientOperationError({
              cause,
              operation: "Query",
            });
          },
          try: () => {
            return context.queryClient.query(getMetaQueryOptions());
          },
        });

        if (meta.apiContractVersion !== API_CONTRACT_VERSION) {
          return yield* new ApiContractVersionError({
            apiContractVersion: meta.apiContractVersion,
            expectedApiContractVersion: API_CONTRACT_VERSION,
          });
        }

        /* [KEEP]
         * Primed here (rather than left to whichever component first reads
         * it) so DungeonRunProvider - mounted above any routed page, outside
         * any route-level Suspense boundary - can read it without an extra
         * fetch waterfall.
         */
        yield* E.tryPromise({
          catch: (cause) => {
            return new QueryClientOperationError({
              cause,
              operation: "Query",
            });
          },
          try: () => {
            return context.queryClient.query({
              ...getConfigurationsQueryOptions(),
              staleTime: "static",
            });
          },
        });

        const settings = yield* getAppSettings();
        const fellowshipCatalogData = yield* FellowshipCatalogData;
        const catalog = yield* fellowshipCatalogData.get;

        return {
          catalog,
          settings,
        };
      }),
    );
  },
});
