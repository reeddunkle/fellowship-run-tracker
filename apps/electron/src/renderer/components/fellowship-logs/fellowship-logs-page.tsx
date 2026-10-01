import { type AbilityApiAbilityList } from "@frt/shared/ability/ability-api-schema.ts";
import { type DungeonApiDungeonList } from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type EncounterApiEncounterList } from "@frt/shared/encounter/encounter-api-schema.ts";
import { type UnitApiUnitList } from "@frt/shared/unit/unit-api-schema.ts";
import {
  PageDescription,
  PageHeader,
  PageShell,
  PageTitle,
} from "@frt/ui/composites/page.tsx";
import { Section, SectionTitle } from "@frt/ui/composites/section.tsx";
import { Separator } from "@frt/ui/primitives/separator.tsx";

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
        <PageShell>
          <PageHeader>
            <PageTitle>Fellowship Logs</PageTitle>
            <PageDescription>
              Import dungeon runs from Fellowship Logs and manage your rate
              limit.
            </PageDescription>
          </PageHeader>
          <FellowshipLogsRateLimitSection />
          <FellowshipLogsAnalyticsSection />
          <Separator />
          <Section>
            <SectionTitle>Import a run</SectionTitle>
            <ImportDungeonRunSection />
          </Section>
          <Separator />
          <Section>
            <SectionTitle>Import queue</SectionTitle>
            <BackgroundJobCategoryList
              categoryId="fellowship-logs-import"
              emptyMessage="Nothing is queued or running."
            />
          </Section>
          <Separator />
          <Section>
            <SectionTitle>Imported runs</SectionTitle>
            <ImportedDungeonRunsList />
          </Section>
          {import.meta.env.DEV &&
          import.meta.env.PUBLIC_SIMULATE_FELLOWSHIP_LOGS_IMPORTS ? (
            <SimulatedImportPanel />
          ) : null}
        </PageShell>
      </AppLayout>
    </FellowshipDataProvider>
  );
}
