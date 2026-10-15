import { type TrackingApiStatus } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";

const ACTIVE_TRACKING_STATUSES: ReadonlySet<TrackingApiStatus["status"]> =
  new Set(["Starting", "Tracking", "WaitingForLogFile"]);

export function isTrackingActive(
  trackingStatus: TrackingApiStatus | null | undefined,
): boolean {
  return (
    trackingStatus !== null &&
    trackingStatus !== undefined &&
    ACTIVE_TRACKING_STATUSES.has(trackingStatus.status)
  );
}
