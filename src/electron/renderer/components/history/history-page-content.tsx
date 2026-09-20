import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";

import { deleteDungeonRunHistoryMutationOptions } from "@/electron/renderer/api/dungeon-run/dungeon-run-mutations.ts";
import { getDungeonRunHistoryQueryOptions } from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { HistoryComparisonTable } from "@/electron/renderer/components/history/history-comparison-table.tsx";
import { createHistoryRequirementComparisonRows } from "@/electron/renderer/components/history/history-requirement-comparison.ts";
import { HistorySummaryMessage } from "@/electron/renderer/components/history/history-summary-message.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import { useSelectedConfiguration } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import {
  getComparisonDungeonRunHistorySummary,
  getOwnDungeonRunHistorySummary,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-history-summary.ts";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";

export function HistoryPageContent() {
  const selectedConfiguration = useSelectedConfiguration();
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);
  const queryClient = useQueryClient();

  const dungeonId = selectedConfiguration?.dungeonId;
  const dungeonLevel = selectedConfiguration?.dungeonLevel;

  const historyQuery = useQuery({
    ...getDungeonRunHistoryQueryOptions({
      dungeonId: dungeonId ?? "0",
      dungeonLevel: dungeonLevel ?? 1,
    }),
    enabled: dungeonId !== undefined && dungeonLevel !== undefined,
  });

  const deleteHistoryMutation = useMutation(
    deleteDungeonRunHistoryMutationOptions(queryClient),
  );

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

  const observations = historyQuery.data?.observations ?? [];

  const ownSummary = getOwnDungeonRunHistorySummary(historyQuery.data);
  const comparisonSummary = getComparisonDungeonRunHistorySummary(
    historyQuery.data,
  );

  const comparisonRows = createHistoryRequirementComparisonRows({
    milestones: selectedConfiguration.milestones,
    observations,
  });

  function handleDeleteHistory() {
    if (dungeonId === undefined || dungeonLevel === undefined) {
      return;
    }

    deleteHistoryMutation.mutate({
      dungeonId,
      dungeonLevel,
    });
  }

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm font-medium">{selectedConfiguration.label}</p>
        <p className="text-sm text-muted-foreground">
          {dungeonName} · Eternal {selectedConfiguration.dungeonLevel}
        </p>
      </header>
      {historyQuery.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading history...
        </div>
      ) : historyQuery.isError ? (
        <p className="text-sm text-destructive">Failed to load history.</p>
      ) : (
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
                    disabled={deleteHistoryMutation.isPending}
                    onClick={handleDeleteHistory}
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
      )}
    </section>
  );
}
