import { TriangleAlertIcon, UnplugIcon } from "lucide-react";
import { useState } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@frt/ui/primitives/alert.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";

import { useDisconnectFellowshipLogs } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-mutations.ts";

import { getConnectionErrorMessage } from "./get-connection-error-message.ts";

export function DisconnectControl() {
  const [isConfirming, setIsConfirming] = useState(false);
  const disconnectMutation = useDisconnectFellowshipLogs();

  if (!isConfirming) {
    return (
      <Button
        onClick={() => {
          setIsConfirming(true);
        }}
        type="button"
        variant="destructive"
      >
        <UnplugIcon />
        Disconnect from Fellowship Logs
      </Button>
    );
  }

  return (
    <Alert
      aria-describedby="fellowship-logs-disconnect-description"
      aria-labelledby="fellowship-logs-disconnect-title"
      className="basis-full"
      role="alertdialog"
      variant="warning"
    >
      <TriangleAlertIcon />
      <AlertTitle id="fellowship-logs-disconnect-title">
        Disconnect from Fellowship Logs?
      </AlertTitle>
      <AlertDescription id="fellowship-logs-disconnect-description">
        This deletes the sign-in or client secret stored on this device. Your
        imported runs, import queue, and cached reports stay. Queued imports
        wait until you connect again.
        {disconnectMutation.isError ? (
          <p role="alert">
            {getConnectionErrorMessage(disconnectMutation.error)}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={disconnectMutation.isPending}
            onClick={() => {
              disconnectMutation.mutate();
            }}
            size="sm"
            type="button"
            variant="destructive"
          >
            Disconnect
          </Button>
          <Button
            autoFocus
            onClick={() => {
              setIsConfirming(false);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Stay connected
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
