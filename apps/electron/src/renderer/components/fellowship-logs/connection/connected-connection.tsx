import {
  ExternalLinkIcon,
  LogInIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  type FellowshipLogsApiConnection,
  type FellowshipLogsApiStartAuthorizationOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@frt/ui/primitives/alert.tsx";
import { Badge } from "@frt/ui/primitives/badge.tsx";
import { Button, buttonVariants } from "@frt/ui/primitives/button.tsx";

import {
  useCheckFellowshipLogsPointSystemOptIn,
  useStartFellowshipLogsAuthorization,
} from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-mutations.ts";
import { HowPointsWorkButton } from "@/renderer/components/fellowship-logs/fellowship-logs-points-section.tsx";

import { ConnectionCommandFeedback } from "./connection-command-feedback.tsx";
import {
  FELLOWSHIP_LOGS_ACCOUNT_SETTINGS_URL,
  FELLOWSHIP_LOGS_PROFILE_COPY,
  POINT_SYSTEM_OPT_IN_STEPS,
} from "./fellowship-logs-connection-copy.ts";
import { getConnectionErrorMessage } from "./get-connection-error-message.ts";
import { useConnectionCommand } from "./use-connection-command.ts";

const STATUS_BADGES = {
  CONNECTED: { label: "Connected", variant: "success" },
  POINT_SYSTEM_OPT_IN_REQUIRED: { label: "Opt-in needed", variant: "warning" },
  REAUTHORIZATION_REQUIRED: { label: "Sign in again", variant: "warning" },
} as const;

type ConnectedConnectionProps = {
  readonly connection: FellowshipLogsApiConnection;
  readonly onChangeConnection: () => void;
};

function getReconnectOptions(
  connection: FellowshipLogsApiConnection,
): FellowshipLogsApiStartAuthorizationOptions | null {
  if (connection.profile === "FELLOWSHIP_RUN_TRACKER_USER") {
    return {
      allowLocalFallback: false,
      expectedGeneration: connection.generation,
      profile: connection.profile,
      replaceConnection: false,
    };
  }

  if (
    connection.profile === "OWN_CLIENT_USER" &&
    connection.clientId !== null
  ) {
    return {
      allowLocalFallback: false,
      clientId: connection.clientId,
      expectedGeneration: connection.generation,
      profile: connection.profile,
      replaceConnection: false,
    };
  }

  return null;
}

function PointSystemOptInRequired() {
  const checkMutation = useCheckFellowshipLogsPointSystemOptIn();

  return (
    <Alert role="status" variant="warning">
      <TriangleAlertIcon />
      <AlertTitle>Opt into the Fellowship Logs point system</AlertTitle>
      <AlertDescription>
        <p>
          Imports and lookups are paused. Fellowship Logs only lets the app use
          your account points after you opt in. You can't undo the opt-in
          without contacting Fellowship Logs support.
        </p>
        <ol className="list-decimal pl-5">
          {POINT_SYSTEM_OPT_IN_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {checkMutation.data?.result === "OPT_IN_REQUIRED" ? (
          <output className="block">
            Fellowship Logs still reports no opt-in.
          </output>
        ) : null}
        {checkMutation.isError ? (
          <p role="alert">{getConnectionErrorMessage(checkMutation.error)}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={FELLOWSHIP_LOGS_ACCOUNT_SETTINGS_URL}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon />
            Open account settings
          </a>
          <Button
            disabled={checkMutation.isPending}
            onClick={() => {
              checkMutation.mutate();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCwIcon />
            {checkMutation.isPending ? "Checking..." : "Check again"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function ConnectedConnection({
  connection,
  onChangeConnection,
}: ConnectedConnectionProps) {
  const startMutation = useStartFellowshipLogsAuthorization();
  const reconnectCommand = useConnectionCommand(
    (options: FellowshipLogsApiStartAuthorizationOptions) => {
      startMutation.mutate(options);
    },
  );
  const reconnectOptions = getReconnectOptions(connection);
  const profileCopy = FELLOWSHIP_LOGS_PROFILE_COPY[connection.profile];
  const statusBadge = STATUS_BADGES[connection.status];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {connection.connectedUserName === null
            ? profileCopy.title
            : `Signed in as ${connection.connectedUserName}`}
        </p>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <p>
          {profileCopy.spending}. <HowPointsWorkButton />
        </p>
        <p className="text-muted-foreground">
          The app stores this connection encrypted on your computer.
        </p>
      </div>
      {connection.clientId === null ? null : (
        <p className="text-xs text-muted-foreground">
          Client ID <span className="select-text">{connection.clientId}</span>
        </p>
      )}
      {connection.status === "POINT_SYSTEM_OPT_IN_REQUIRED" ? (
        <PointSystemOptInRequired />
      ) : null}
      {connection.status === "REAUTHORIZATION_REQUIRED" ? (
        <StatusText role="status" variant="warning">
          <TriangleAlertIcon />
          Your Fellowship Logs sign-in ended. Sign in again to keep importing.
        </StatusText>
      ) : null}
      <ConnectionCommandFeedback
        error={startMutation.error}
        isPending={startMutation.isPending}
        onRetry={reconnectCommand.retry}
      />
      <div className="flex flex-wrap gap-2">
        {connection.status !== "REAUTHORIZATION_REQUIRED" ||
        reconnectOptions === null ? null : (
          <Button
            disabled={startMutation.isPending}
            onClick={() => {
              reconnectCommand.run(reconnectOptions);
            }}
            type="button"
          >
            <LogInIcon />
            Sign in again
          </Button>
        )}
        <Button onClick={onChangeConnection} type="button" variant="outline">
          Change connection
        </Button>
      </div>
    </div>
  );
}
