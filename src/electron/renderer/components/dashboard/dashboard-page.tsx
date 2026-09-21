import { type AbilityApiAbilityList } from "@/contracts/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@/contracts/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/contracts/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/contracts/unit/unit-api-schema.ts";
import { ConfigurationEditorContainer } from "@/electron/renderer/components/configuration/configuration-editor-container.tsx";
import { ConfigurationWorkspaceLayout } from "@/electron/renderer/components/core/configuration-workspace-layout.tsx";
import { TrackingControls } from "@/electron/renderer/components/dashboard/tracking-controls.tsx";
import { ManagedDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window";
import { DetachedWindowProvider } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { DungeonRun } from "@/electron/renderer/components/dungeon-run/dungeon-run";
import { LiveSplitPanel } from "@/electron/renderer/components/live-split/live-split-panel.tsx";
import { useAppSettings } from "@/electron/renderer/components/providers/settings-provider.tsx";
import { DungeonRunProvider } from "@/electron/renderer/stores/dungeon-run/dungeon-run-provider.tsx";

type DashboardPageProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function DashboardPage({
  abilities,
  dungeons,
  encounters,
  units,
}: DashboardPageProps) {
  const appSettings = useAppSettings();

  return (
    <ConfigurationWorkspaceLayout
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <DungeonRunProvider>
        <DetachedWindowProvider>
          <ManagedDetachedWindow>
            <DungeonRun />
          </ManagedDetachedWindow>
          <main className="mx-auto grid w-full gap-6 p-6">
            {appSettings.isLiveSplitEnabled ? <LiveSplitPanel /> : null}
            <TrackingControls />
            <ConfigurationEditorContainer />
          </main>
        </DetachedWindowProvider>
      </DungeonRunProvider>
    </ConfigurationWorkspaceLayout>
  );
}
