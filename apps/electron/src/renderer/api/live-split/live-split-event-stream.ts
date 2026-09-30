import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type LiveSplitApiMessage,
  LiveSplitApiMessageSchema,
} from "@frt/api-contract/websocket/live-split/live-split-api-message-schema.ts";

import { LiveSplitEventMessageDecodeError } from "@/errors/live-split-event-message-error.ts";
import {
  type ApiEventStreamError,
  type ApiEventStreamEvent,
  makeApiEventStream,
} from "@/renderer/api/make-api-event-stream.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type LiveSplitEventStreamEvent =
  ApiEventStreamEvent<LiveSplitApiMessage>;

export type LiveSplitEventStreamError =
  ApiEventStreamError<LiveSplitEventMessageDecodeError>;

export function makeLiveSplitEventStream(): Stream.Stream<
  LiveSplitEventStreamEvent,
  LiveSplitEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeApiEventStream({
    connectionLostMessage:
      "Lost connection to the LiveSplit event stream; retrying.",
    makeDecodeError: (cause) => {
      return new LiveSplitEventMessageDecodeError({
        cause,
      });
    },
    schema: LiveSplitApiMessageSchema,
    url: getApiWebSocketUrl(ROUTES.liveSplitEvents),
  });
}
