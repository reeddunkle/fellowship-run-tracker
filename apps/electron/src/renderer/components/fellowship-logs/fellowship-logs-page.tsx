import { type AbilityApiAbilityList } from "@frt/shared/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@frt/shared/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@frt/shared/unit/unit-api-schema.ts";
import { Separator } from "@frt/ui/separator.tsx";

import { BackgroundJobCategoryList } from "@/renderer/components/background-jobs/background-job-list.tsx";
import { AppLayout } from "@/renderer/components/core/app-layout.tsx";
import { FellowshipDataProvider } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

import { FellowshipLogsAnalyticsSection } from "./fellowship-logs-analytics-section.tsx";
import { FellowshipLogsRateLimitSection } from "./fellowship-logs-rate-limit-section.tsx";
import { ImportDungeonRunSection } from "./import-dungeon-run-section.tsx";
import { ImportedDungeonRunsList } from "./imported-dungeon-runs-list.tsx";
import { SimulatedImportPanel } from "./simulated-import-panel.tsx";

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
          <FellowshipLogsAnalyticsSection />
          <Separator />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Import a run</p>
            <ImportDungeonRunSection />
          </div>
          <Separator />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Import queue</p>
            <BackgroundJobCategoryList
              categoryId="fellowship-logs-import"
              emptyMessage="Nothing is queued or running."
            />
          </div>
          <Separator />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Imported runs</p>
            <ImportedDungeonRunsList />
          </div>
          {import.meta.env.DEV &&
          import.meta.env.PUBLIC_SIMULATE_FELLOWSHIP_LOGS_IMPORTS ? (
            <SimulatedImportPanel />
          ) : null}
        </main>
      </AppLayout>
    </FellowshipDataProvider>
  );
}
