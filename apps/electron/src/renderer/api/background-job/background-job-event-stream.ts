import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type BackgroundJobApiMessage,
  BackgroundJobApiMessageSchema,
} from "@frt/api-contract/websocket/background-job/background-job-api-message-schema.ts";

import { BackgroundJobEventMessageDecodeError } from "@/errors/background-job-event-message-error.ts";
import {
  type ApiEventStreamError,
  type ApiEventStreamEvent,
  makeApiEventStream,
} from "@/renderer/api/make-api-event-stream.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type BackgroundJobEventStreamEvent =
  ApiEventStreamEvent<BackgroundJobApiMessage>;

export type BackgroundJobEventStreamError =
  ApiEventStreamError<BackgroundJobEventMessageDecodeError>;

export function makeBackgroundJobEventStream(): Stream.Stream<
  BackgroundJobEventStreamEvent,
  BackgroundJobEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeApiEventStream({
    connectionLostMessage:
      "Lost connection to the background job event stream; retrying.",
    makeDecodeError: (cause) => {
      return new BackgroundJobEventMessageDecodeError({
        cause,
      });
    },
    schema: BackgroundJobApiMessageSchema,
    url: getApiWebSocketUrl(ROUTES.backgroundJobEvents),
  });
}
