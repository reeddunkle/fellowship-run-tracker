import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { createTrackingApiStatus } from "@frt/api/application/fellowship-tracker/create-tracking-api-status.ts";
import {
  FellowshipTracker,
  type FellowshipTrackerStatus,
} from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type TrackingApiMessage } from "@frt/api-contract/websocket/tracking/tracking-api-message-schema.ts";

function encodeTrackingApiMessage(status: FellowshipTrackerStatus): string {
  const message = {
    status: createTrackingApiStatus(status),
    version: 1,
  } satisfies TrackingApiMessage;

  return JSON.stringify(message);
}

export const makeTrackingChannelFeed = E.gen(function* () {
  const fellowshipTracker = yield* FellowshipTracker;

  return fellowshipTracker.statusChanges.pipe(
    Stream.map(encodeTrackingApiMessage),
  );
});
