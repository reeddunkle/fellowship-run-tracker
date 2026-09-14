import { AppLayout } from "@/electron/renderer/components/core/app-layout.tsx";
import { AppearanceSettings } from "@/electron/renderer/components/settings/appearance-settings.tsx";
import { SettingsEditor } from "@/electron/renderer/components/settings/settings-editor.tsx";

export function SettingsPage() {
  return (
    <AppLayout>
      <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure LiveSplit and Fellowship integration settings.
          </p>
        </div>
        <SettingsEditor />
        <AppearanceSettings />
      </main>
    </AppLayout>
  );
}
