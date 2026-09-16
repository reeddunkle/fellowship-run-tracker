import { HistoryIcon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { useSelectedConfigurationId } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import {
  useDungeonRunActions,
  useDungeonRunServerState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";

function getHistoryMessage({
  hasSelectedConfiguration,
  historicalObservationCount,
  historicalSampleCount,
}: {
  readonly hasSelectedConfiguration: boolean;
  readonly historicalObservationCount: number;
  readonly historicalSampleCount: number;
}): string {
  if (!hasSelectedConfiguration) {
    return "Select a saved configuration to view its historical timing data.";
  }

  if (historicalSampleCount === 0) {
    return "No historical timing data is available for this configuration.";
  }

  const sampleLabel = historicalSampleCount === 1 ? "sample" : "samples";

  const observationLabel =
    historicalObservationCount === 1 ? "observation" : "observations";

  return `${historicalSampleCount} historical ${sampleLabel} across ${historicalObservationCount} tracked ${observationLabel}.`;
}

export function ConfigurationEditorHistory() {
  const selectedConfigurationId = useSelectedConfigurationId();

  const { deleteHistory } = useDungeonRunActions();
  const { history } = useDungeonRunServerState();

  const historicalSampleCount =
    history?.observations.reduce((sampleCount, observation) => {
      return sampleCount + observation.sampleCount;
    }, 0) ?? 0;

  const historicalObservationCount = history?.observations.length ?? 0;

  const hasHistory = historicalSampleCount > 0;

  const historyMessage = getHistoryMessage({
    hasSelectedConfiguration: selectedConfigurationId !== null,
    historicalObservationCount,
    historicalSampleCount,
  });

  return (
    <section className="grid max-w-xl gap-3 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">Run history</h2>
        <p className="text-sm text-muted-foreground">{historyMessage}</p>
      </div>
      {hasHistory ? (
        <div>
          <Button
            onClick={() => {
              deleteHistory();
            }}
            type="button"
            variant="outline"
          >
            <HistoryIcon />
            Clear historical times
          </Button>
        </div>
      ) : null}
    </section>
  );
}
