import { HistoryIcon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { useSelectedConfigurationId } from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import {
  useDungeonRunActions,
  useDungeonRunServerState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";

export function ConfigurationEditorHistory() {
  const selectedConfigurationId = useSelectedConfigurationId();

  const { deleteHistoryForConfigurationId } = useDungeonRunActions();
  const { history } = useDungeonRunServerState();

  const selectedConfigurationHistory =
    history?.configurationId === selectedConfigurationId ? history : null;

  const historicalSampleCount =
    selectedConfigurationHistory?.observations.reduce(
      (sampleCount, observation) => {
        return sampleCount + observation.sampleCount;
      },
      0,
    ) ?? 0;

  const historicalObservationCount =
    selectedConfigurationHistory?.observations.length ?? 0;

  const hasHistory = historicalSampleCount > 0;

  return (
    <section className="grid max-w-xl gap-3 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">Run history</h2>
        <p className="text-sm text-muted-foreground">
          {selectedConfigurationId === null
            ? "Select a saved configuration to view its historical timing data."
            : hasHistory
              ? `${historicalSampleCount} historical ${
                  historicalSampleCount === 1 ? "sample" : "samples"
                } across ${historicalObservationCount} tracked ${
                  historicalObservationCount === 1
                    ? "observation"
                    : "observations"
                }.`
              : "No historical timing data is available for this configuration."}
        </p>
      </div>
      {hasHistory ? (
        <div>
          <Button
            onClick={() => {
              if (selectedConfigurationId === null) {
                return;
              }

              deleteHistoryForConfigurationId(selectedConfigurationId);
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
