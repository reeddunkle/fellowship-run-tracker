import { LinkIcon, UnlinkIcon } from "lucide-react";

import { API_EVENT_CONNECTION_STATE } from "@/electron/renderer/api/common.ts";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  useLiveSplitActionState,
  useLiveSplitActions,
  useLiveSplitServerState,
} from "@/electron/renderer/stores/live-split/live-split-provider.tsx";

export function LiveSplitControls() {
  const { connect, disconnect } = useLiveSplitActions();
  const { isPending } = useLiveSplitActionState();
  const { eventConnectionState, serverStatus } = useLiveSplitServerState();

  const isEventConnected =
    eventConnectionState === API_EVENT_CONNECTION_STATE.CONNECTED;

  const isConnected = serverStatus?.status === "Connected";

  return (
    <div className="flex gap-2">
      <Button
        disabled={!isEventConnected || isConnected || isPending}
        onClick={connect}
        type="button"
        variant="outline"
      >
        <LinkIcon />
        Connect
      </Button>
      <Button
        disabled={!isEventConnected || !isConnected || isPending}
        onClick={disconnect}
        type="button"
        variant="outline"
      >
        <UnlinkIcon />
        Disconnect
      </Button>
    </div>
  );
}
