import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { LiveSplitApiConnectionError } from "@frt/api-contract/errors/live-split-api-error.ts";
import { LiveSplitApiStatusSchema } from "@frt/shared/live-split/live-split-api-schema.ts";

const LIVE_SPLIT_ROUTE = "/live-split" as const;
const LIVE_SPLIT_CONNECTION_ROUTE = `${LIVE_SPLIT_ROUTE}/connect` as const;

const GetLiveSplitEndpoint = HttpApiEndpoint.get(
  "getLiveSplitConnection",
  LIVE_SPLIT_CONNECTION_ROUTE,
  {
    success: LiveSplitApiStatusSchema,
  },
);

const ConnectLiveSplitEndpoint = HttpApiEndpoint.post(
  "connectLiveSplit",
  LIVE_SPLIT_CONNECTION_ROUTE,
  {
    error: LiveSplitApiConnectionError,
    success: LiveSplitApiStatusSchema,
  },
);

const DisconnectLiveSplitEndpoint = HttpApiEndpoint.delete(
  "disconnectLiveSplit",
  LIVE_SPLIT_CONNECTION_ROUTE,
  {
    success: LiveSplitApiStatusSchema,
  },
);

export const LiveSplitApi = HttpApiGroup.make("liveSplit").add(
  GetLiveSplitEndpoint,
  ConnectLiveSplitEndpoint,
  DisconnectLiveSplitEndpoint,
);
