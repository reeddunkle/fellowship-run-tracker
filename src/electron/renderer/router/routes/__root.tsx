import { createRootRouteWithContext } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { getAppSettings } from "@/electron/renderer/api/app-settings/app-settings-client.ts";
import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import { RootLayout } from "@/electron/renderer/components/core/root-layout";
import { type RouterContext } from "@/electron/renderer/router/router-context";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  loader: ({ context }) => {
    return context.browserRuntime.runPromise(
      E.gen(function* () {
        /*
         * Primed here (rather than left to whichever component first reads
         * it) so DungeonRunProvider - mounted above any routed page, outside
         * any route-level Suspense boundary - can read it without an extra
         * fetch waterfall.
         */
        yield* E.tryPromise({
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
        });

        const settings = yield* getAppSettings();

        return {
          settings,
        };
      }),
    );
  },
});
