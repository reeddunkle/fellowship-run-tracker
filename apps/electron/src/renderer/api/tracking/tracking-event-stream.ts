import * as Cause from "effect/Cause";
import type * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Socket from "effect/unstable/socket/Socket";

import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type TrackingApiMessage,
  TrackingApiMessageSchema,
} from "@frt/api-contract/websocket/tracking/tracking-api-message-schema.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

import { TrackingEventMessageDecodeError } from "@/errors/tracking-event-message-error.ts";
import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type TrackingEventStreamEvent =
  | {
      readonly state: ApiEventConnectionState;
      readonly type: "CONNECTION_STATE_CHANGED";
    }
  | {
      readonly message: TrackingApiMessage;
      readonly type: "MESSAGE_RECEIVED";
    };

export type TrackingEventStreamError =
  | TrackingEventMessageDecodeError
  | Socket.SocketError;

type MakeTrackingEventStreamOptions = {
  readonly reconnectDelay?: Duration.Input;
};

const DEFAULT_RECONNECT_DELAY = "1 second";

const RECONNECT_WARNING_THRESHOLD = 3;

function offerConnectionState(
  queue: Queue.Enqueue<TrackingEventStreamEvent>,
  state: ApiEventConnectionState,
) {
  return Queue.offer(queue, {
    state,
    type: "CONNECTION_STATE_CHANGED",
  });
}

const TrackingApiMessageFromJsonStringSchema = Schema.fromJsonString(
  TrackingApiMessageSchema,
);

function decodeMessage(
  message: string,
): E.Effect<TrackingApiMessage, TrackingEventMessageDecodeError> {
  return Schema.decodeEffect(TrackingApiMessageFromJsonStringSchema)(
    message,
  ).pipe(
    E.mapError((cause) => {
      return new TrackingEventMessageDecodeError({
        cause,
      });
    }),
  );
}

function makeTrackingEventStreamForUrl(
  url: string,
  options: MakeTrackingEventStreamOptions = {},
): Stream.Stream<
  TrackingEventStreamEvent,
  TrackingEventStreamError,
  Socket.WebSocketConstructor
> {
  const reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;

  return Stream.callback<
    TrackingEventStreamEvent,
    TrackingEventStreamError,
    Socket.WebSocketConstructor
  >((queue) => {
    return E.gen(function* () {
      const connectionFailures = yield* makeRepeatedFailureLogger({
        level: "Warn",
        message: "Lost connection to the tracking event stream; retrying.",
        threshold: RECONNECT_WARNING_THRESHOLD,
      });

      const connect = E.gen(function* () {
        yield* offerConnectionState(
          queue,
          API_EVENT_CONNECTION_STATE.CONNECTING,
        );

        const socket = yield* Socket.makeWebSocket(url, {
          closeCodeIsError: (code) => {
            return code !== 1000;
          },
          openTimeout: "5 seconds",
        });

        yield* socket.runString(
          (data) => {
            return E.gen(function* () {
              const message = yield* decodeMessage(data);

              yield* Queue.offer(queue, {
                message,
                type: "MESSAGE_RECEIVED",
              });
            });
          },
          {
            onOpen: offerConnectionState(
              queue,
              API_EVENT_CONNECTION_STATE.CONNECTED,
            ).pipe(E.andThen(connectionFailures.onSuccess)),
          },
        );
      }).pipe(
        E.ensuring(
          offerConnectionState(queue, API_EVENT_CONNECTION_STATE.DISCONNECTED),
        ),
      );

      return yield* connect.pipe(
        E.tapError((error) => {
          return error instanceof TrackingEventMessageDecodeError
            ? E.void
            : connectionFailures.onFailure(Cause.fail(error)).pipe(E.asVoid);
        }),
        E.retry({
          schedule: Schedule.spaced(reconnectDelay),
          while: (error) => {
            return !(error instanceof TrackingEventMessageDecodeError);
          },
        }),
        E.repeat(Schedule.spaced(reconnectDelay)),
        E.catchCause((cause) => {
          return E.sync(() => {
            Queue.failCauseUnsafe(queue, cause);
          });
        }),
      );
    });
  });
}

export function makeTrackingEventStream(): Stream.Stream<
  TrackingEventStreamEvent,
  TrackingEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeTrackingEventStreamForUrl(
    getApiWebSocketUrl(ROUTES.trackingEvents),
  );
}
