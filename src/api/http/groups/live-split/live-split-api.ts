import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { LiveSplitApiStatusSchema } from "@/contracts/live-split/live-split-api-schema.ts";
import { LiveSplitApiConnectionErrorSchema } from "@/errors/live-split-client-error.ts";

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
    error: LiveSplitApiConnectionErrorSchema,
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
