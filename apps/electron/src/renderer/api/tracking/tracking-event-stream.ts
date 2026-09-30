import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type TrackingApiMessage,
  TrackingApiMessageSchema,
} from "@frt/api-contract/websocket/tracking/tracking-api-message-schema.ts";

import { TrackingEventMessageDecodeError } from "@/errors/tracking-event-message-error.ts";
import {
  type ApiEventStreamError,
  type ApiEventStreamEvent,
  makeApiEventStream,
} from "@/renderer/api/make-api-event-stream.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type TrackingEventStreamEvent = ApiEventStreamEvent<TrackingApiMessage>;

export type TrackingEventStreamError =
  ApiEventStreamError<TrackingEventMessageDecodeError>;

export function makeTrackingEventStream(): Stream.Stream<
  TrackingEventStreamEvent,
  TrackingEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeApiEventStream({
    connectionLostMessage:
      "Lost connection to the tracking event stream; retrying.",
    makeDecodeError: (cause) => {
      return new TrackingEventMessageDecodeError({
        cause,
      });
    },
    schema: TrackingApiMessageSchema,
    url: getApiWebSocketUrl(ROUTES.trackingEvents),
  });
}
