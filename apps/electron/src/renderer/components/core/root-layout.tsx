import { getRouteApi, Outlet } from "@tanstack/react-router";

import { TooltipProvider } from "@frt/ui/tooltip.tsx";

import { SettingsProvider } from "@/renderer/components/providers/settings-provider.tsx";
import { ThemeProvider } from "@/renderer/components/providers/theme-provider.tsx";
import { LiveSplitProvider } from "@/renderer/stores/live-split/live-split-provider.tsx";
import { TrackingProvider } from "@/renderer/stores/tracking/tracking-provider.tsx";

const rootRouteApi = getRouteApi("__root__");

export function RootLayout() {
  const { settings } = rootRouteApi.useLoaderData();

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SettingsProvider appSettings={settings}>
          <TrackingProvider>
            <LiveSplitProvider>
              <Outlet />
            </LiveSplitProvider>
          </TrackingProvider>
        </SettingsProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
