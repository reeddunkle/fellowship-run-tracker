import * as Cause from "effect/Cause";
import type * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";

import { ROUTES } from "@frt/api-contract/constants/routes.ts";
import {
  type LiveSplitApiMessage,
  LiveSplitApiMessageSchema,
} from "@frt/api-contract/websocket/live-split/live-split-api-message-schema.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

import { LiveSplitEventMessageDecodeError } from "@/errors/live-split-event-message-error.ts";
import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url";

export type LiveSplitEventStreamEvent =
  | {
      readonly state: ApiEventConnectionState;
      readonly type: "CONNECTION_STATE_CHANGED";
    }
  | {
      readonly message: LiveSplitApiMessage;
      readonly type: "MESSAGE_RECEIVED";
    };

export type LiveSplitEventStreamError =
  | LiveSplitEventMessageDecodeError
  | Socket.SocketError;

type MakeLiveSplitEventStreamOptions = {
  readonly reconnectDelay?: Duration.Input;
};

const DEFAULT_RECONNECT_DELAY = "1 second";

const RECONNECT_WARNING_THRESHOLD = 3;

function offerConnectionState(
  queue: Queue.Enqueue<LiveSplitEventStreamEvent>,
  state: ApiEventConnectionState,
) {
  return Queue.offer(queue, {
    state,
    type: "CONNECTION_STATE_CHANGED",
  });
}

const LiveSplitApiMessageFromJsonStringSchema = Schema.fromJsonString(
  LiveSplitApiMessageSchema,
);

function decodeMessage(
  message: string,
): E.Effect<LiveSplitApiMessage, LiveSplitEventMessageDecodeError> {
  return Schema.decodeEffect(LiveSplitApiMessageFromJsonStringSchema)(
    message,
  ).pipe(
    E.mapError((cause) => {
      return new LiveSplitEventMessageDecodeError({
        cause,
      });
    }),
  );
}

function makeLiveSplitEventStreamForUrl(
  url: string,
  options: MakeLiveSplitEventStreamOptions = {},
): Stream.Stream<
  LiveSplitEventStreamEvent,
  LiveSplitEventStreamError,
  Socket.WebSocketConstructor
> {
  const reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;

  return Stream.callback<
    LiveSplitEventStreamEvent,
    LiveSplitEventStreamError,
    Socket.WebSocketConstructor
  >((queue) => {
    return E.gen(function* () {
      const connectionFailures = yield* makeRepeatedFailureLogger({
        level: "Warn",
        message: "Lost connection to the LiveSplit event stream; retrying.",
        threshold: RECONNECT_WARNING_THRESHOLD,
      });

      const connect = E.gen(function* () {
        yield* offerConnectionState(
          queue,
          API_EVENT_CONNECTION_STATE.CONNECTING,
        );

        const socket = yield* Socket.makeWebSocket(url, {
          openTimeout: "5 seconds",
        });

        const pull = yield* Socket.readerString(socket);

        yield* offerConnectionState(
          queue,
          API_EVENT_CONNECTION_STATE.CONNECTED,
        ).pipe(E.andThen(connectionFailures.onSuccess));

        return yield* pull.pipe(
          E.flatMap((data) => {
            return E.forEach(data, decodeMessage);
          }),
          E.flatMap((messages) => {
            return Queue.offerAll(
              queue,
              messages.map((message): LiveSplitEventStreamEvent => {
                return {
                  message,
                  type: "MESSAGE_RECEIVED",
                };
              }),
            );
          }),
          E.forever,
        );
      }).pipe(
        E.catchReason("SocketError", "SocketCloseError", (reason, error) => {
          return reason.code === 1000 ? E.void : E.fail(error);
        }),
        E.scoped,
        E.ensuring(
          offerConnectionState(queue, API_EVENT_CONNECTION_STATE.DISCONNECTED),
        ),
      );

      return yield* connect.pipe(
        E.tapError((error) => {
          return error instanceof LiveSplitEventMessageDecodeError
            ? E.void
            : connectionFailures.onFailure(Cause.fail(error)).pipe(E.asVoid);
        }),
        E.retry({
          schedule: Schedule.spaced(reconnectDelay),
          while: (error) => {
            return !(error instanceof LiveSplitEventMessageDecodeError);
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

export function makeLiveSplitEventStream(): Stream.Stream<
  LiveSplitEventStreamEvent,
  LiveSplitEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeLiveSplitEventStreamForUrl(
    getApiWebSocketUrl(ROUTES.liveSplitEvents),
  );
}
