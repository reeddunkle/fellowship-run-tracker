import { type AbilityApiAbilityList } from "@frt/shared/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@frt/shared/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@frt/shared/unit/unit-api-schema.ts";

import { ConfigurationWorkspaceLayout } from "@/renderer/components/core/configuration-workspace-layout.tsx";
import { HistoryPageContent } from "@/renderer/components/history/history-page-content.tsx";

type HistoryPageProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function HistoryPage({
  abilities,
  dungeons,
  encounters,
  units,
}: HistoryPageProps) {
  return (
    <ConfigurationWorkspaceLayout
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <main className="mx-auto grid w-full gap-6 p-6">
        <HistoryPageContent />
      </main>
    </ConfigurationWorkspaceLayout>
  );
}
