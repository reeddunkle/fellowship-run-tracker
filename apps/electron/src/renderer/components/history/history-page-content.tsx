import { CatchBoundary } from "@tanstack/react-router";
import { HistoryIcon } from "lucide-react";
import { Suspense } from "react";

import { type ConfigurationApiConfiguration } from "@frt/shared/configuration/configuration-api-schema.ts";
import {
  PageDescription,
  PageHeader,
  PageTitle,
} from "@frt/ui/composites/page.tsx";
import {
  Section,
  SectionHeader,
  SectionTitle,
} from "@frt/ui/composites/section.tsx";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { Separator } from "@frt/ui/primitives/separator.tsx";

import { useDeleteDungeonRunHistory } from "@/renderer/api/dungeon-run/dungeon-run-mutations.ts";
import { useDungeonRunHistorySuspense } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";
import {
  HistoryComparisonTable,
  HistoryComparisonTableSkeleton,
} from "@/renderer/components/history/history-comparison-table.tsx";
import { createHistoryRequirementComparisonRows } from "@/renderer/components/history/history-requirement-comparison.ts";
import {
  HistorySummaryMessage,
  HistorySummaryMessageSkeleton,
} from "@/renderer/components/history/history-summary-message.tsx";
import { logBoundaryError } from "@/renderer/logging/renderer-error-logging.ts";
import { useSelectedConfiguration } from "@/renderer/stores/configuration/configuration-provider.tsx";
import {
  getComparisonDungeonRunHistorySummary,
  getOwnDungeonRunHistorySummary,
} from "@/renderer/stores/dungeon-run/dungeon-run-history-summary.ts";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

export function HistoryPageContent() {
  const selectedConfiguration = useSelectedConfiguration();
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);
  if (selectedConfiguration === undefined) {
    return (
      <PageHeader>
        <PageTitle>History</PageTitle>
        <PageDescription>
          Select a saved configuration from the sidebar to view its historical
          data.
        </PageDescription>
      </PageHeader>
    );
  }

  const dungeonName =
    dungeonsById[selectedConfiguration.dungeonId]?.name ??
    selectedConfiguration.dungeonId;

  return (
    <section className="grid gap-6">
      <PageHeader>
        <PageTitle>History</PageTitle>
        <p className="text-sm font-medium">{selectedConfiguration.label}</p>
        <PageDescription>
          {dungeonName} · Eternal {selectedConfiguration.dungeonLevel}
        </PageDescription>
      </PageHeader>
      <CatchBoundary
        errorComponent={HistoryLoadError}
        getResetKey={() =>
          `${selectedConfiguration.dungeonId}:${selectedConfiguration.dungeonLevel}`
        }
        onCatch={logBoundaryError}
      >
        <Suspense
          fallback={
            <HistoryPageContentSkeleton configuration={selectedConfiguration} />
          }
          key={`${selectedConfiguration.dungeonId}:${selectedConfiguration.dungeonLevel}`}
        >
          <HistoryDataContent configuration={selectedConfiguration} />
        </Suspense>
      </CatchBoundary>
    </section>
  );
}

function HistoryLoadError() {
  return <StatusText variant="destructive">Failed to load history.</StatusText>;
}

type HistoryDataContentProps = {
  readonly configuration: ConfigurationApiConfiguration;
};

function HistoryPageContentSkeleton({
  configuration,
}: HistoryDataContentProps) {
  const rows = createHistoryRequirementComparisonRows({
    milestones: configuration.milestones,
    observations: [],
  });
  return (
    <section
      aria-busy="true"
      aria-label="Loading history"
      aria-live="polite"
      className="grid gap-6"
    >
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        {["My historical data", "Comparison data"].map((title) => (
          <Section key={title} variant="outline">
            <SectionHeader>
              <SectionTitle>{title}</SectionTitle>
              <HistorySummaryMessageSkeleton />
            </SectionHeader>
          </Section>
        ))}
      </div>
      {rows.length > 0 ? (
        <>
          <Separator />
          <Section aria-hidden="true">
            <SectionTitle>Checkpoint comparison</SectionTitle>
            <HistoryComparisonTableSkeleton rows={rows} />
          </Section>
        </>
      ) : null}
    </section>
  );
}

function HistoryDataContent({ configuration }: HistoryDataContentProps) {
  const { dungeonId, dungeonLevel, milestones } = configuration;

  const history = useDungeonRunHistorySuspense({ dungeonId, dungeonLevel });
  const deleteDungeonRunHistory = useDeleteDungeonRunHistory({
    dungeonId,
    dungeonLevel,
  });

  const observations = history.observations;

  const ownSummary = getOwnDungeonRunHistorySummary(history);
  const comparisonSummary = getComparisonDungeonRunHistorySummary(history);

  const comparisonRows = createHistoryRequirementComparisonRows({
    milestones,
    observations,
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section variant="outline">
          <SectionHeader>
            <SectionTitle>My historical data</SectionTitle>
            <HistorySummaryMessage
              emptyMessage="No historical timing data is available for this configuration."
              runCount={ownSummary.runCount}
              sampleCount={ownSummary.sampleCount}
            />
          </SectionHeader>
          {ownSummary.runCount > 0 ? (
            <div>
              <Button
                disabled={deleteDungeonRunHistory.isPending}
                onClick={deleteDungeonRunHistory.delete}
                type="button"
                variant="outline"
              >
                <HistoryIcon />
                Clear historical times
              </Button>
            </div>
          ) : null}
        </Section>
        <Section variant="outline">
          <SectionHeader>
            <SectionTitle>Comparison data</SectionTitle>
            <HistorySummaryMessage
              emptyMessage="No comparison data yet. Import a Fellowship Logs run that isn't marked as yours to compare against."
              runCount={comparisonSummary.runCount}
              sampleCount={comparisonSummary.sampleCount}
            />
          </SectionHeader>
        </Section>
      </div>
      {comparisonRows.length > 0 ? (
        <>
          <Separator />
          <Section>
            <SectionTitle>Checkpoint comparison</SectionTitle>
            <HistoryComparisonTable rows={comparisonRows} />
          </Section>
        </>
      ) : null}
    </>
  );
}
