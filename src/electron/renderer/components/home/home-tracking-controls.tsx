import {
  Minimize2Icon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
  SquareIcon,
} from "lucide-react";

import {
  type TrackingApiFailure,
  type TrackingApiStatus,
} from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import {
  useConfigurationById,
  useSelectedConfiguration,
  useSelectedConfigurationId,
} from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import { useDungeonRunServerState } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import {
  useTrackingActionState,
  useTrackingActions,
  useTrackingServerState,
} from "@/electron/renderer/stores/tracking-store/tracking-store.tsx";
import { cn } from "@/util/class-names.ts";

type TrackingMessageProps = {
  readonly configurationLabel: string;
  readonly trackingStatus: TrackingApiStatus | undefined;
};

const FAILURE_MESSAGE_BY_TYPE: Record<TrackingApiFailure["type"], string> = {
  Configuration:
    "Tracking stopped because the configuration could not be processed.",
  FileSystem:
    "Tracking stopped because the Fellowship log file could not be monitored.",
  Unexpected: "Tracking stopped because of an unexpected error.",
};

function getTrackingMessage({
  configurationLabel,
  trackingStatus,
}: TrackingMessageProps): string {
  if (trackingStatus === undefined || trackingStatus.status === "Idle") {
    return `Start tracking a dungeon run using "${configurationLabel}"`;
  }

  if (trackingStatus.status === "WaitingForLogFile") {
    return "Waiting for a Fellowship log file…";
  }

  if (trackingStatus.status === "Tracking") {
    return `Tracking "${configurationLabel}"`;
  }

  return FAILURE_MESSAGE_BY_TYPE[trackingStatus.failure.type];
}

function TrackingMessage({
  configurationLabel,
  trackingStatus,
}: TrackingMessageProps) {
  const isFailed = trackingStatus?.status === "Failed";

  const message = getTrackingMessage({
    configurationLabel,
    trackingStatus,
  });

  return (
    <p
      className={cn("text-sm", {
        "text-destructive": isFailed,
        "text-muted-foreground":
          trackingStatus === undefined || trackingStatus.status === "Idle",
        "text-muted-foreground/60":
          trackingStatus?.status === "WaitingForLogFile" ||
          trackingStatus?.status === "Tracking",
      })}
    >
      {message}
    </p>
  );
}

export function HomeTrackingControls() {
  const selectedConfiguration = useSelectedConfiguration();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { start, stop } = useTrackingActions();
  const { isPending } = useTrackingActionState();
  const { trackingStatus } = useTrackingServerState();
  const { isActiveRun } = useDungeonRunServerState();

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
      <div className="flex items-center gap-3">
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
