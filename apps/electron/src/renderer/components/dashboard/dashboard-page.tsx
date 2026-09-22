import { type AbilityApiAbilityList } from "@frt/shared/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@frt/shared/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@frt/shared/unit/unit-api-schema.ts";

import { ConfigurationEditorContainer } from "@/renderer/components/configuration/configuration-editor-container.tsx";
import { ConfigurationWorkspaceLayout } from "@/renderer/components/core/configuration-workspace-layout.tsx";
import { TrackingControls } from "@/renderer/components/dashboard/tracking-controls.tsx";
import { ManagedDetachedWindow } from "@/renderer/components/detached-window/detached-window";
import { DetachedWindowProvider } from "@/renderer/components/detached-window/detached-window-provider";
import { DungeonRun } from "@/renderer/components/dungeon-run/dungeon-run";
import { LiveSplitPanel } from "@/renderer/components/live-split/live-split-panel.tsx";
import { useAppSettings } from "@/renderer/components/providers/settings-provider.tsx";
import { DungeonRunProvider } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";

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
