import { getRouteApi, Outlet } from "@tanstack/react-router";

import { Toaster } from "@frt/ui/toast.tsx";
import { TooltipProvider } from "@frt/ui/tooltip.tsx";

import { BackgroundJobToasts } from "@/renderer/components/background-jobs/background-job-toasts.tsx";
import { SettingsProvider } from "@/renderer/components/providers/settings-provider.tsx";
import { ThemeProvider } from "@/renderer/components/providers/theme-provider.tsx";
import { FellowshipDataProvider } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { LiveSplitProvider } from "@/renderer/stores/live-split/live-split-provider.tsx";
import { TrackingProvider } from "@/renderer/stores/tracking/tracking-provider.tsx";

const rootRouteApi = getRouteApi("__root__");

export function RootLayout() {
  const { catalog, settings } = rootRouteApi.useLoaderData();

  return (
    <ThemeProvider>
      <TooltipProvider>
        <FellowshipDataProvider
          abilities={catalog.abilities}
          dungeons={catalog.dungeons}
          encounters={catalog.encounters}
          units={catalog.units}
        >
          <Toaster>
            <BackgroundJobToasts />
            <SettingsProvider appSettings={settings}>
              <TrackingProvider>
                <LiveSplitProvider>
                  <Outlet />
                </LiveSplitProvider>
              </TrackingProvider>
            </SettingsProvider>
          </Toaster>
        </FellowshipDataProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
