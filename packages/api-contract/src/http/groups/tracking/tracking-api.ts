import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  StartTrackingApiRequestSchema,
  TrackingApiStatusSchema,
} from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";
import {
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
  TrackingApiStartError,
} from "@frt/api-contract/errors/tracking-api-error.ts";

const TRACKING_ROUTE = "/tracking" as const;

const GetTrackingEndpoint = HttpApiEndpoint.get("getTracking", TRACKING_ROUTE, {
  success: TrackingApiStatusSchema,
});

const StartTrackingEndpoint = HttpApiEndpoint.post(
  "startTracking",
  TRACKING_ROUTE,
  {
    error: [
      TrackingApiAlreadyRunningError,
      TrackingApiConfigurationNotFoundError,
      TrackingApiStartError,
    ],
    payload: StartTrackingApiRequestSchema,
    success: TrackingApiStatusSchema,
  },
);

const StopTrackingEndpoint = HttpApiEndpoint.delete(
  "stopTracking",
  TRACKING_ROUTE,
  {
    success: TrackingApiStatusSchema,
  },
);

export const TrackingApi = HttpApiGroup.make("tracking").add(
  GetTrackingEndpoint,
  StartTrackingEndpoint,
  StopTrackingEndpoint,
);
