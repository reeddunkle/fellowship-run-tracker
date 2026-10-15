import { PlayIcon, SquareIcon } from "lucide-react";

import { Button } from "@frt/ui/primitives/button.tsx";
import { Spinner } from "@frt/ui/primitives/spinner.tsx";

import { useSelectedConfigurationId } from "@/renderer/stores/configuration/configuration-provider.tsx";
import { useDungeonRunServerState } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";
import { isTrackingActive } from "@/renderer/stores/tracking/is-tracking-active.ts";
import {
  useTrackingActionState,
  useTrackingActions,
  useTrackingServerState,
} from "@/renderer/stores/tracking/tracking-provider.tsx";

type TrackingStartStopButtonsProps = {
  readonly onStart?: () => void;
};

export function TrackingStartStopButtons({
  onStart,
}: TrackingStartStopButtonsProps) {
  const selectedConfigurationId = useSelectedConfigurationId();

  const { start, stop } = useTrackingActions();
  const { isPending } = useTrackingActionState();
  const { trackingStatus } = useTrackingServerState();
  const { isActiveRun } = useDungeonRunServerState();

  const isTracking = trackingStatus?.status === "Tracking";

  return (
    <>
      <Button
        className="min-w-32"
        disabled={
          selectedConfigurationId === null ||
          isPending ||
          isTrackingActive(trackingStatus)
        }
        onClick={() => {
          if (selectedConfigurationId === null) {
            return;
          }

          start(selectedConfigurationId);
          onStart?.();
        }}
        size="xl"
        type="button"
        variant="success"
      >
        {isTracking ? (
          <>
            <Spinner className="size-6" />
            {isActiveRun ? "Active run" : "Waiting for run"}
          </>
        ) : (
          <>
            <PlayIcon className="fill-current" />
            Start
          </>
        )}
      </Button>
      <Button
        className="min-w-32"
        disabled={!isTracking || isPending}
        onClick={stop}
        size="xl"
        type="button"
        variant="destructive"
      >
        <SquareIcon className="fill-current" />
        Stop
      </Button>
    </>
  );
}
