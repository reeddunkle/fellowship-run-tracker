import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type TrackingApiMessage } from "@/api/websocket/tracking/tracking-api-message-schema.ts";
import { createTrackingApiStatus } from "@/application/fellowship-tracker/create-tracking-api-status.ts";
import {
  FellowshipTracker,
  type FellowshipTrackerStatus,
} from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  TrackingWebSocketBroadcaster,
  type WebSocketBroadcasterService,
} from "@/services/api/websocket-broadcaster-service.ts";

type PublishTrackingApiStatusOptions = {
  readonly status: FellowshipTrackerStatus;
  readonly webSocketBroadcaster: WebSocketBroadcasterService;
};

function publishTrackingApiStatus({
  status,
  webSocketBroadcaster,
}: PublishTrackingApiStatusOptions) {
  const message = {
    status: createTrackingApiStatus(status),
    version: 1,
  } satisfies TrackingApiMessage;

  return webSocketBroadcaster.publish(JSON.stringify(message));
}

export const publishTrackingStatusChanges = E.gen(function* () {
  const fellowshipTracker = yield* FellowshipTracker;
  const trackingWebSocketBroadcaster = yield* TrackingWebSocketBroadcaster;

  yield* fellowshipTracker.statusChanges.pipe(
    Stream.runForEach((status) => {
      return publishTrackingApiStatus({
        status,
        webSocketBroadcaster: trackingWebSocketBroadcaster,
      });
    }),
  );
});
