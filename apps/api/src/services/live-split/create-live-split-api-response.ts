import * as Match from "effect/Match";

import { type ConnectionStatus } from "@frt/api/util/connection-manager/make-connection-manager.ts";
import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

export function createLiveSplitApiResponse(
  status: ConnectionStatus,
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
