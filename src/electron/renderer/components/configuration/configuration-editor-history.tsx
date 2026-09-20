import { Link } from "@tanstack/react-router";
import { HistoryIcon } from "lucide-react";

import { HistorySummaryMessage } from "@/electron/renderer/components/history/history-summary-message.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { useSelectedConfigurationId } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import { getOwnDungeonRunHistorySummary } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-history-summary.ts";
import { useDungeonRunServerState } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";

export function ConfigurationEditorHistory() {
  const selectedConfigurationId = useSelectedConfigurationId();
  const { history } = useDungeonRunServerState();

  const { runCount, sampleCount } = getOwnDungeonRunHistorySummary(history);

  const emptyMessage =
    selectedConfigurationId === null
      ? "Select a saved configuration to view its historical timing data."
      : "No historical timing data is available for this configuration.";

  return (
    <section className="grid max-w-xl gap-3 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">Run history</h2>
        <HistorySummaryMessage
          emptyMessage={emptyMessage}
          runCount={runCount}
          sampleCount={sampleCount}
        />
      </div>
      <div>
        <Button render={<Link to="/history" />} type="button" variant="outline">
          <HistoryIcon />
          View history
        </Button>
      </div>
    </section>
  );
}
