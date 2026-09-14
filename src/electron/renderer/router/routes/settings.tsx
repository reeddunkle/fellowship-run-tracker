import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/electron/renderer/components/settings/settings-page.tsx";

function SettingsRoute() {
  return <SettingsPage />;
}

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});
