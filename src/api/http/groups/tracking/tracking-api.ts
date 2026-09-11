import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  StartTrackingApiRequestSchema,
  TrackingApiStatusSchema,
} from "@/application/fellowship-tracker/tracking-api-schema.ts";
import {
  TrackingApiAlreadyRunningErrorSchema,
  TrackingApiConfigurationNotFoundErrorSchema,
  TrackingApiStartErrorSchema,
} from "@/errors/fellowship-tracker-error.ts";

const TRACKING_ROUTE = "/tracking" as const;

const GetTrackingEndpoint = HttpApiEndpoint.get("getTracking", TRACKING_ROUTE, {
  success: TrackingApiStatusSchema,
});

const StartTrackingEndpoint = HttpApiEndpoint.post(
  "startTracking",
  TRACKING_ROUTE,
  {
    error: [
      TrackingApiAlreadyRunningErrorSchema,
      TrackingApiConfigurationNotFoundErrorSchema,
      TrackingApiStartErrorSchema,
    ],
    payload: StartTrackingApiRequestSchema,
    success: TrackingApiStatusSchema,
  },
);

const StopTrackingEndpoint = HttpApiEndpoint.delete(
  "stopTracking",
  TRACKING_ROUTE,
  {
    error: TrackingApiStartErrorSchema,
    success: TrackingApiStatusSchema,
  },
);

export const TrackingApi = HttpApiGroup.make("tracking").add(
  GetTrackingEndpoint,
  StartTrackingEndpoint,
  StopTrackingEndpoint,
);
