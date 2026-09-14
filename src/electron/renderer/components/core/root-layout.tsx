import { getRouteApi, Outlet, useRouter } from "@tanstack/react-router";
import * as E from "effect/Effect";

import { ThemeProvider } from "@/electron/renderer/components/providers/theme-provider.tsx";
import { TooltipProvider } from "@/electron/renderer/components/ui/tooltip.tsx";
import { DungeonRunProvider } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider";
import { LiveSplitProvider } from "@/electron/renderer/stores/live-split/live-split-store";
import { TrackingProvider } from "@/electron/renderer/stores/tracking-store/tracking-store.tsx";
import { RouterInvalidationError } from "@/errors/router-invalidation-error.ts";

const rootRouteApi = getRouteApi("__root__");

function invalidateRouter(router: ReturnType<typeof useRouter>) {
  return E.tryPromise({
    catch: (cause) => {
      return new RouterInvalidationError({ cause });
    },
    try: () => {
      return router.invalidate({
        sync: true,
      });
    },
  });
}

export function RootLayout() {
  const { history } = rootRouteApi.useLoaderData();
  const router = useRouter();

  return (
    <ThemeProvider>
      <TooltipProvider>
        <TrackingProvider>
          <LiveSplitProvider>
            <DungeonRunProvider
              history={history}
              invalidate={() => {
                return invalidateRouter(router);
              }}
            >
              <Outlet />
            </DungeonRunProvider>
          </LiveSplitProvider>
        </TrackingProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
