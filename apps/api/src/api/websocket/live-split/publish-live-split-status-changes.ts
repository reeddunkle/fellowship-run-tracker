import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  LiveSplitWebSocketBroadcaster,
  type WebSocketBroadcasterService,
} from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { LiveSplitApiService } from "@frt/api/services/api/live-split/live-split-api-service.ts";
import {
  type LiveSplitApiMessage,
  LiveSplitApiMessageSchema,
} from "@frt/api-contract/websocket/live-split/live-split-api-message-schema.ts";
import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

const encodeLiveSplitApiMessage = Schema.encodeEffect(
  Schema.fromJsonString(LiveSplitApiMessageSchema),
);

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

  return encodeLiveSplitApiMessage(message).pipe(
    E.flatMap((encodedMessage) => {
      return webSocketBroadcaster.publish(encodedMessage);
    }),
  );
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
