import { ConfigurationEditorContainer } from "@/electron/renderer/components/configuration/configuration-editor-container.tsx";
import { ConfigurationSidebar } from "@/electron/renderer/components/configuration/sidebar/configuration-sidebar.tsx";
import { AppLayout } from "@/electron/renderer/components/core/app-layout.tsx";
import { ManagedDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window";
import { DetachedWindowProvider } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { DungeonRun } from "@/electron/renderer/components/dungeon-run/dungeon-run";
import { HomeTrackingControls } from "@/electron/renderer/components/home/home-tracking-controls.tsx";
import { LiveSplitPanel } from "@/electron/renderer/components/live-split/live-split-panel.tsx";
import { ConfigurationProvider } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import { FellowshipDataProvider } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { type AbilityApiAbilityList } from "@/services/api/ability/ability-api-schema.ts";
import { type ConfigurationApiConfigurationList } from "@/services/api/configuration/configuration-api-schema.ts";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/services/api/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/services/api/unit/unit-api-schema.ts";

type HomePageProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly configurations: ConfigurationApiConfigurationList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function HomePage({
  abilities,
  configurations,
  dungeons,
  encounters,
  units,
}: HomePageProps) {
  return (
    <FellowshipDataProvider
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <ConfigurationProvider configurations={configurations}>
        <DetachedWindowProvider>
          <ManagedDetachedWindow>
            <DungeonRun />
          </ManagedDetachedWindow>
          <AppLayout sidebar={<ConfigurationSidebar />}>
            <main className="mx-auto grid w-full gap-6 p-6">
              <LiveSplitPanel />
              <HomeTrackingControls />
              <ConfigurationEditorContainer />
            </main>
          </AppLayout>
        </DetachedWindowProvider>
      </ConfigurationProvider>
    </FellowshipDataProvider>
  );
}
