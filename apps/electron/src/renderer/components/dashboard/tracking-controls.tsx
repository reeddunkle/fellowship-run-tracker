import { Minimize2Icon, SquareArrowOutUpRightIcon } from "lucide-react";

import {
  type TrackingApiFailure,
  type TrackingApiStatus,
} from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { cn } from "@frt/ui/styles/class-names.ts";

import { getTrackingActionErrorMessage } from "@/renderer/components/dashboard/get-tracking-action-error-message.ts";
import { useDetachedWindow } from "@/renderer/components/detached-window/detached-window-provider.tsx";
import { TrackingStartStopButtons } from "@/renderer/components/tracking/tracking-start-stop-buttons.tsx";
import {
  useConfigurationById,
  useSelectedConfiguration,
  useSelectedConfigurationId,
} from "@/renderer/stores/configuration/configuration-provider.tsx";
import { isTrackingActive } from "@/renderer/stores/tracking/is-tracking-active.ts";
import {
  useTrackingActionState,
  useTrackingServerState,
} from "@/renderer/stores/tracking/tracking-provider.tsx";

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

  if (trackingStatus.status === "Starting") {
    return "Starting tracker…";
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
        "text-muted-foreground/60": isTrackingActive(trackingStatus),
      })}
    >
      {message}
    </p>
  );
}

export function TrackingControls() {
  const selectedConfiguration = useSelectedConfiguration();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { isPending, startError, stopError } = useTrackingActionState();
  const { trackingStatus } = useTrackingServerState();

  const detachedWindow = useDetachedWindow();

  const isTracking = trackingStatus?.status === "Tracking";

  const actionErrorMessage = isPending
    ? undefined
    : getTrackingActionErrorMessage({
        isTrackingActive: isTrackingActive(trackingStatus),
        startError,
        stopError,
      });

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
        <TrackingStartStopButtons onStart={detachedWindow.open} />
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
      {actionErrorMessage !== undefined && (
        <StatusText role="alert" variant="destructive">
          {actionErrorMessage}
        </StatusText>
      )}
      {selectedConfigurationId === null && !isTracking && (
        <StatusText>Save the configuration before starting a run.</StatusText>
      )}
    </section>
  );
}
