import * as Match from "effect/Match";

import { type LiveSplitConnectionStatus } from "@frt/api/services/live-split/core/live-split-connection-manager-service.ts";
import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

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
