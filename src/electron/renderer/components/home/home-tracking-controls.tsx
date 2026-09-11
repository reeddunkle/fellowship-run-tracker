import * as Match from "effect/Match";
import {
  Minimize2Icon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
  SquareIcon,
} from "lucide-react";

import { type TrackingApiStatus } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import {
  useConfigurationById,
  useSelectedConfiguration,
  useSelectedConfigurationId,
} from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import {
  useTrackingActionState,
  useTrackingActions,
  useTrackingServerState,
} from "@/electron/renderer/stores/tracking-store/tracking-store.tsx";

type TrackingMessageProps = {
  readonly configurationLabel: string;
  readonly trackingStatus: TrackingApiStatus | undefined;
};

function TrackingMessage({
  configurationLabel,
  trackingStatus,
}: TrackingMessageProps) {
  if (trackingStatus === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Start tracking a dungeon run using "{configurationLabel}"
      </p>
    );
  }

  return Match.value(trackingStatus).pipe(
    Match.when(
      {
        status: "Idle",
      },
      () => {
        return (
          <p className="text-sm text-muted-foreground">
            Start tracking a dungeon run using "{configurationLabel}"
          </p>
        );
      },
    ),
    Match.when(
      {
        status: "WaitingForLogFile",
      },
      () => {
        return (
          <p className="flex items-center gap-2 text-sm text-muted-foreground/60">
            Waiting for a Fellowship log file…
          </p>
        );
      },
    ),
    Match.when(
      {
        status: "Tracking",
      },
      () => {
        return (
          <p className="flex items-center gap-2 text-sm text-muted-foreground/60">
            Tracking "{configurationLabel}"
          </p>
        );
      },
    ),
    Match.when(
      {
        status: "Failed",
      },
      ({ failure }) => {
        return Match.value(failure).pipe(
          Match.when(
            {
              type: "Configuration",
            },
            () => {
              return (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  Tracking stopped because the configuration could not be
                  processed.
                </p>
              );
            },
          ),
          Match.when(
            {
              type: "FileSystem",
            },
            () => {
              return (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  Tracking stopped because the Fellowship log file could not be
                  monitored.
                </p>
              );
            },
          ),
          Match.when(
            {
              type: "Unexpected",
            },
            () => {
              return (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  Tracking stopped because of an unexpected error.
                </p>
              );
            },
          ),
          Match.exhaustive,
        );
      },
    ),
    Match.exhaustive,
  );
}

export function HomeTrackingControls() {
  const selectedConfiguration = useSelectedConfiguration();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { start, stop } = useTrackingActions();
  const { isPending } = useTrackingActionState();
  const { trackingStatus } = useTrackingServerState();

  const detachedWindow = useDetachedWindow();

  const isTracking = trackingStatus?.status === "Tracking";
  const isWaitingForFile = trackingStatus?.status === "WaitingForLogFile";

  const trackingConfigurationId =
    trackingStatus?.status === "Tracking" &&
    trackingStatus.source.type === "Persisted"
      ? trackingStatus.source.configurationId
      : null;

  const trackingConfiguration = useConfigurationById(trackingConfigurationId);

  const configurationLabel = isTracking
    ? trackingConfiguration?.label
    : selectedConfiguration?.label;

  return (
    <section className="flex flex-col items-end gap-3">
      <div className="flex gap-3 items-center">
        <Button
          className="min-w-32 bg-green-600 text-white hover:bg-green-700"
          disabled={
            selectedConfigurationId === null ||
            isTracking ||
            isPending ||
            isWaitingForFile
          }
          onClick={() => {
            if (selectedConfigurationId === null) {
              return;
            }

            start(selectedConfigurationId);
            detachedWindow.open();
          }}
          size="xl"
          type="button"
        >
          {isTracking ? (
            <>
              <Spinner className="size-6" />
              Tracking
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
        {detachedWindow.isOpen ? (
          <Button
            onClick={detachedWindow.close}
            type="button"
            variant="outline"
          >
            <Minimize2Icon />
            Close tracker
          </Button>
        ) : (
          <Button onClick={detachedWindow.open} type="button" variant="outline">
            <SquareArrowOutUpRightIcon />
            Open tracker
          </Button>
        )}
      </div>

      {configurationLabel !== undefined && trackingStatus !== null && (
        <TrackingMessage
          configurationLabel={configurationLabel}
          trackingStatus={trackingStatus}
        />
      )}

      {selectedConfigurationId === null && !isTracking && (
        <p className="text-sm text-muted-foreground">
          Save the configuration before starting a run.
        </p>
      )}
    </section>
  );
}
