import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type LiveSplitApiMessage } from "@/api/websocket/live-split/live-split-api-message-schema.ts";
import { type LiveSplitApiStatus } from "@/services/api/live-split/live-split-api-schema.ts";
import { LiveSplitApiService } from "@/services/api/live-split/live-split-api-service.ts";
import {
  LiveSplitWebSocketBroadcaster,
  type WebSocketBroadcasterService,
} from "@/services/api/websocket-broadcaster-service.ts";

type PublishLiveSplitApiStatusOptions = {
  readonly status: LiveSplitApiStatus;
  readonly webSocketBroadcaster: WebSocketBroadcasterService;
};

function publishLiveSplitApiStatus({
  status,
  webSocketBroadcaster,
}: PublishLiveSplitApiStatusOptions) {
  const message = {
    status,
    version: 1,
  } satisfies LiveSplitApiMessage;

  return webSocketBroadcaster.publish(JSON.stringify(message));
}

export const publishLiveSplitStatusChanges = E.gen(function* () {
  const liveSplitApiService = yield* LiveSplitApiService;
  const liveSplitWebSocketBroadcaster = yield* LiveSplitWebSocketBroadcaster;

  yield* liveSplitApiService.statusChanges.pipe(
    Stream.runForEach((status) => {
      return publishLiveSplitApiStatus({
        status,
        webSocketBroadcaster: liveSplitWebSocketBroadcaster,
      });
    }),
  );
});
