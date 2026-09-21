import { getRouteApi, Outlet } from "@tanstack/react-router";

import { SettingsProvider } from "@/electron/renderer/components/providers/settings-provider.tsx";
import { ThemeProvider } from "@/electron/renderer/components/providers/theme-provider.tsx";
import { TooltipProvider } from "@/electron/renderer/components/ui/tooltip.tsx";
import { LiveSplitProvider } from "@/electron/renderer/stores/live-split/live-split-provider.tsx";
import { TrackingProvider } from "@/electron/renderer/stores/tracking/tracking-provider.tsx";

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
