import { Link } from "@tanstack/react-router";
import { HistoryIcon } from "lucide-react";

import { buttonVariants } from "@frt/ui/button.tsx";

import { HistorySummaryMessage } from "@/renderer/components/history/history-summary-message.tsx";
import { useSelectedConfigurationId } from "@/renderer/stores/configuration/configuration-provider.tsx";
import { getOwnDungeonRunHistorySummary } from "@/renderer/stores/dungeon-run/dungeon-run-history-summary.ts";
import { useDungeonRunServerState } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";

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
        <Link className={buttonVariants({ variant: "outline" })} to="/history">
          <HistoryIcon />
          View history
        </Link>
      </div>
    </section>
  );
}
