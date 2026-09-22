import { type ReactNode } from "react";

import { type AbilityApiAbilityList } from "@frt/shared/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@frt/shared/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@frt/shared/unit/unit-api-schema.ts";

import { ConfigurationSidebar } from "@/renderer/components/configuration/sidebar/configuration-sidebar.tsx";
import { AppLayout } from "@/renderer/components/core/app-layout.tsx";
import { ConfigurationProvider } from "@/renderer/stores/configuration/configuration-provider.tsx";
import { FellowshipDataProvider } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

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
