import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  type LiveSplitApiMessage,
  LiveSplitApiMessageSchema,
} from "@/api/websocket/live-split/live-split-api-message-schema.ts";
import { type LiveSplitApiStatus } from "@/contracts/live-split/live-split-api-schema.ts";
import { LiveSplitApiService } from "@/services/api/live-split/live-split-api-service.ts";
import {
  LiveSplitWebSocketBroadcaster,
  type WebSocketBroadcasterService,
} from "@/services/api/websocket-broadcaster-service.ts";

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
