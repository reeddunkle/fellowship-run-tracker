import { LinkIcon, UnlinkIcon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  useLiveSplitActionState,
  useLiveSplitActions,
  useLiveSplitServerState,
} from "@/electron/renderer/stores/live-split/live-split-store.tsx";

export function LiveSplitControls() {
  const { connect, disconnect } = useLiveSplitActions();

  const { isPending } = useLiveSplitActionState();

  const { liveSplitStatus } = useLiveSplitServerState();

  const isConnected = liveSplitStatus?.status === "Connected";

  return (
    <div className="flex gap-2">
      <Button
        disabled={isConnected || isPending}
        onClick={connect}
        type="button"
        variant="outline"
      >
        <LinkIcon />
        Connect
      </Button>

      <Button
        disabled={!isConnected || isPending}
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
