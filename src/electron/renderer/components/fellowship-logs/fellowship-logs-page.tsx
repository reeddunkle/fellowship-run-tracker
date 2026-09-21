import { type AbilityApiAbilityList } from "@/contracts/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@/contracts/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@/contracts/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@/contracts/unit/unit-api-schema.ts";
import { AppLayout } from "@/electron/renderer/components/core/app-layout.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";
import { FellowshipDataProvider } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";

import { FellowshipLogsRateLimitSection } from "./fellowship-logs-rate-limit-section.tsx";
import { ImportDungeonRunSection } from "./import-dungeon-run-section.tsx";
import { ImportedDungeonRunsList } from "./imported-dungeon-runs-list.tsx";

type FellowshipLogsPageProps = {
  readonly abilities: AbilityApiAbilityList;
  readonly dungeons: DungeonApiDungeonList;
  readonly encounters: EncounterApiEncounterList;
  readonly units: UnitApiUnitList;
};

export function FellowshipLogsPage({
  abilities,
  dungeons,
  encounters,
  units,
}: FellowshipLogsPageProps) {
  return (
    <FellowshipDataProvider
      abilities={abilities}
      dungeons={dungeons}
      encounters={encounters}
      units={units}
    >
      <AppLayout>
        <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold">Fellowship Logs</h1>
            <p className="text-sm text-muted-foreground">
              Import dungeon runs from Fellowship Logs and manage your rate
              limit.
            </p>
          </div>
          <FellowshipLogsRateLimitSection />
          <Separator />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Import a run</p>
            <ImportDungeonRunSection />
          </div>
          <Separator />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Imported runs</p>
            <ImportedDungeonRunsList />
          </div>
        </main>
      </AppLayout>
    </FellowshipDataProvider>
  );
}
