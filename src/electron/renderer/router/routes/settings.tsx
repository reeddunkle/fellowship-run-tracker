import { createFileRoute } from "@tanstack/react-router";

import { getAppSettings } from "@/electron/renderer/api/app-settings/app-settings-client.ts";
import { SettingsPage } from "@/electron/renderer/components/settings/settings-page.tsx";

function SettingsRoute() {
  const appSettings = Route.useLoaderData();

  return <SettingsPage appSettings={appSettings} />;
}

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
  loader: ({ context }) => {
    return context.browserRuntime.runPromise(getAppSettings());
  },
});
