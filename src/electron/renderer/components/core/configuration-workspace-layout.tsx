import { type ReactNode } from "react";

import { ConfigurationSidebar } from "@/electron/renderer/components/configuration/sidebar/configuration-sidebar.tsx";
import { AppLayout } from "@/electron/renderer/components/core/app-layout.tsx";
import { ConfigurationProvider } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import { FellowshipDataProvider } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import { type AbilityApiAbilityList } from "@/services/api/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/services/api/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/services/api/unit/unit-api-schema.ts";

type ConfigurationWorkspaceLayoutProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly children: ReactNode;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function ConfigurationWorkspaceLayout({
  abilities,
  children,
  dungeons,
  encounters,
  units,
}: ConfigurationWorkspaceLayoutProps) {
  return (
    <FellowshipDataProvider
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <ConfigurationProvider>
        <AppLayout sidebar={<ConfigurationSidebar />}>{children}</AppLayout>
      </ConfigurationProvider>
    </FellowshipDataProvider>
  );
}
