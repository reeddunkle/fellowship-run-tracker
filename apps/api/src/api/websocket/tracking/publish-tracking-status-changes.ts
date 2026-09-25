import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import {
  TrackingWebSocketBroadcaster,
  type WebSocketBroadcasterShape,
} from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { createTrackingApiStatus } from "@frt/api/application/fellowship-tracker/create-tracking-api-status.ts";
import {
  FellowshipTracker,
  type FellowshipTrackerStatus,
} from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type TrackingApiMessage } from "@frt/api-contract/websocket/tracking/tracking-api-message-schema.ts";

type PublishTrackingApiStatusOptions = {
  readonly status: FellowshipTrackerStatus;
  readonly webSocketBroadcaster: WebSocketBroadcasterShape;
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
