import { CircleIcon } from "lucide-react";

import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/electron/renderer/api/common.ts";
import {
  useLiveSplitActionState,
  useLiveSplitServerState,
} from "@/electron/renderer/stores/live-split/live-split-store.tsx";
import { LiveSplitApiConnectionError } from "@/errors/live-split-client-error.ts";
import { type LiveSplitApiStatus } from "@/services/api/live-split/live-split-api-schema.ts";
import { cn } from "@/util/class-names.ts";

const statusLabelByConnectionState: Record<ApiEventConnectionState, string> = {
  [API_EVENT_CONNECTION_STATE.CONNECTED]: "Connected",
  [API_EVENT_CONNECTION_STATE.CONNECTING]: "Connecting…",
  [API_EVENT_CONNECTION_STATE.DISCONNECTED]: "Disconnected",
  [API_EVENT_CONNECTION_STATE.ERROR]: "Connection failed",
};

type GetLiveSplitConnectionStateOptions = {
  readonly error: unknown | undefined;
  readonly eventConnectionState: ApiEventConnectionState;
  readonly isConnecting: boolean;
  readonly isDisconnecting: boolean;
  readonly serverStatus: LiveSplitApiStatus | null;
};

function getLiveSplitConnectionState({
  error,
  eventConnectionState,
  isConnecting,
  isDisconnecting,
  serverStatus,
}: GetLiveSplitConnectionStateOptions): ApiEventConnectionState {
  const hasError = [
    error !== undefined,
    eventConnectionState === API_EVENT_CONNECTION_STATE.ERROR,
  ].some(Boolean);

  if (hasError) {
    return API_EVENT_CONNECTION_STATE.ERROR;
  }

  const isConnectionPending = [
    isConnecting,
    eventConnectionState === API_EVENT_CONNECTION_STATE.CONNECTING,
  ].some(Boolean);

  if (isConnectionPending) {
    return API_EVENT_CONNECTION_STATE.CONNECTING;
  }

  const isConnected = [
    !isDisconnecting,
    eventConnectionState === API_EVENT_CONNECTION_STATE.CONNECTED,
    serverStatus?.status === "Connected",
  ].every(Boolean);

  return isConnected
    ? API_EVENT_CONNECTION_STATE.CONNECTED
    : API_EVENT_CONNECTION_STATE.DISCONNECTED;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof LiveSplitApiConnectionError) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected LiveSplit error occurred.";
}

export function LiveSplitStatus() {
  const { connectError, disconnectError, isConnecting, isDisconnecting } =
    useLiveSplitActionState();
  const { eventConnectionState, serverStatus } = useLiveSplitServerState();

  const error = connectError ?? disconnectError;

  const status = getLiveSplitConnectionState({
    error,
    eventConnectionState,
    isConnecting,
    isDisconnecting,
    serverStatus,
  });

  const statusLabel = statusLabelByConnectionState[status];

  return (
    <div className="flex items-center gap-2">
      <CircleIcon
        className={cn("size-3 fill-current", {
          "text-green-600": status === API_EVENT_CONNECTION_STATE.CONNECTED,
          "text-red-600": status === API_EVENT_CONNECTION_STATE.ERROR,
        })}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium">LiveSplit</span>
        <span className="text-sm text-muted-foreground">{statusLabel}</span>
        {error !== undefined && (
          <span className="text-sm text-red-600">{getErrorMessage(error)}</span>
        )}
      </div>
    </div>
  );
}
