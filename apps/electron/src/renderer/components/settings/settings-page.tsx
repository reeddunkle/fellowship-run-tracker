import {
  PageDescription,
  PageHeader,
  PageShell,
  PageTitle,
} from "@frt/ui/composites/page.tsx";

import { AppLayout } from "@/renderer/components/core/app-layout.tsx";
import { AppearanceSettings } from "@/renderer/components/settings/appearance-settings.tsx";
import { DiagnosticsSettings } from "@/renderer/components/settings/diagnostics-settings.tsx";
import { SettingsEditor } from "@/renderer/components/settings/settings-editor.tsx";

export function SettingsPage() {
  return (
    <AppLayout>
      <PageShell>
        <PageHeader>
          <PageTitle>Settings</PageTitle>
          <PageDescription>
            Configure LiveSplit and Fellowship integration settings.
          </PageDescription>
        </PageHeader>
        <SettingsEditor />
        <AppearanceSettings />
        <DiagnosticsSettings />
      </PageShell>
    </AppLayout>
  );
}
