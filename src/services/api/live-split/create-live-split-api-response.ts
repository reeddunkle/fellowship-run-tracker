import * as Match from "effect/Match";

import { type LiveSplitApiStatus } from "@/services/api/live-split/live-split-api-schema.ts";
import { type LiveSplitConnectionStatus } from "@/services/live-split/core/live-split-connection-manager-service.ts";

export function createLiveSplitApiResponse(
  status: LiveSplitConnectionStatus,
): LiveSplitApiStatus {
  return Match.value(status).pipe(
    Match.when(
      {
        _tag: "Disconnected",
      },
      (): LiveSplitApiStatus => {
        return {
          status: "Disconnected",
        };
      },
    ),
    Match.when(
      {
        _tag: "Connected",
      },
      (): LiveSplitApiStatus => {
        return {
          status: "Connected",
        };
      },
    ),
    Match.exhaustive,
  );
}
