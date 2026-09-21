import { type AbilityApiAbilityList } from "@/contracts/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@/contracts/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/contracts/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/contracts/unit/unit-api-schema.ts";
import { ConfigurationWorkspaceLayout } from "@/electron/renderer/components/core/configuration-workspace-layout.tsx";
import { HistoryPageContent } from "@/electron/renderer/components/history/history-page-content.tsx";

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
