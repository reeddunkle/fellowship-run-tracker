import { CatchBoundary } from "@tanstack/react-router";
import { HistoryIcon } from "lucide-react";
import { Suspense } from "react";

import { type ConfigurationApiConfiguration } from "@frt/shared/configuration/configuration-api-schema.ts";
import { Button } from "@frt/ui/button.tsx";
import { Separator } from "@frt/ui/separator.tsx";

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
      <section className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Select a saved configuration from the sidebar to view its historical
          data.
        </p>
      </section>
    );
  }

  const dungeonName =
    dungeonsById[selectedConfiguration.dungeonId]?.name ??
    selectedConfiguration.dungeonId;

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm font-medium">{selectedConfiguration.label}</p>
        <p className="text-sm text-muted-foreground">
          {dungeonName} · Eternal {selectedConfiguration.dungeonLevel}
        </p>
      </header>
      <CatchBoundary
        errorComponent={HistoryLoadError}
        getResetKey={() =>
          `${selectedConfiguration.dungeonId}:${selectedConfiguration.dungeonLevel}`
        }
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
  return <p className="text-sm text-destructive">Failed to load history.</p>;
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
          <section className="grid gap-3 rounded-lg border p-4" key={title}>
            <div className="grid gap-1">
              <h2 className="text-sm font-medium">{title}</h2>
              <HistorySummaryMessageSkeleton />
            </div>
          </section>
        ))}
      </div>
      {rows.length > 0 ? (
        <>
          <Separator />
          <div aria-hidden="true" className="grid gap-2">
            <h2 className="text-sm font-medium">Checkpoint comparison</h2>
            <HistoryComparisonTableSkeleton rows={rows} />
          </div>
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
        <section className="grid gap-3 rounded-lg border p-4">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">My historical data</h2>
            <HistorySummaryMessage
              emptyMessage="No historical timing data is available for this configuration."
              runCount={ownSummary.runCount}
              sampleCount={ownSummary.sampleCount}
            />
          </div>
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
        </section>
        <section className="grid gap-3 rounded-lg border p-4">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">Comparison data</h2>
            <HistorySummaryMessage
              emptyMessage="No comparison data yet. Import a Fellowship Logs run that isn't marked as yours to compare against."
              runCount={comparisonSummary.runCount}
              sampleCount={comparisonSummary.sampleCount}
            />
          </div>
        </section>
      </div>
      {comparisonRows.length > 0 ? (
        <>
          <Separator />
          <div className="grid gap-2">
            <h2 className="text-sm font-medium">Checkpoint comparison</h2>
            <HistoryComparisonTable rows={comparisonRows} />
          </div>
        </>
      ) : null}
    </>
  );
}
