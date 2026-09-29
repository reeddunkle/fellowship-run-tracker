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
  type BackgroundJobApiMessage,
  BackgroundJobApiMessageSchema,
} from "@frt/api-contract/websocket/background-job/background-job-api-message-schema.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

import { BackgroundJobEventMessageDecodeError } from "@/errors/background-job-event-message-error.ts";
import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import { getApiWebSocketUrl } from "@/renderer/services/app-api-client/api-url.ts";

export type BackgroundJobEventStreamEvent =
  | {
      readonly state: ApiEventConnectionState;
      readonly type: "CONNECTION_STATE_CHANGED";
    }
  | {
      readonly message: BackgroundJobApiMessage;
      readonly type: "MESSAGE_RECEIVED";
    };

export type BackgroundJobEventStreamError =
  | BackgroundJobEventMessageDecodeError
  | Socket.SocketError;

type MakeBackgroundJobEventStreamOptions = {
  readonly reconnectDelay?: Duration.Input;
};

const DEFAULT_RECONNECT_DELAY = "1 second";

const RECONNECT_WARNING_THRESHOLD = 3;

function offerConnectionState(
  queue: Queue.Enqueue<BackgroundJobEventStreamEvent>,
  state: ApiEventConnectionState,
) {
  return Queue.offer(queue, {
    state,
    type: "CONNECTION_STATE_CHANGED",
  });
}

const BackgroundJobApiMessageFromJsonStringSchema = Schema.fromJsonString(
  BackgroundJobApiMessageSchema,
);

function decodeMessage(
  message: string,
): E.Effect<BackgroundJobApiMessage, BackgroundJobEventMessageDecodeError> {
  return Schema.decodeEffect(BackgroundJobApiMessageFromJsonStringSchema)(
    message,
  ).pipe(
    E.mapError((cause) => {
      return new BackgroundJobEventMessageDecodeError({
        cause,
      });
    }),
  );
}

function makeBackgroundJobEventStreamForUrl(
  url: string,
  options: MakeBackgroundJobEventStreamOptions = {},
): Stream.Stream<
  BackgroundJobEventStreamEvent,
  BackgroundJobEventStreamError,
  Socket.WebSocketConstructor
> {
  const reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;

  return Stream.callback<
    BackgroundJobEventStreamEvent,
    BackgroundJobEventStreamError,
    Socket.WebSocketConstructor
  >((queue) => {
    return E.gen(function* () {
      const connectionFailures = yield* makeRepeatedFailureLogger({
        level: "Warn",
        message:
          "Lost connection to the background job event stream; retrying.",
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
              messages.map((message): BackgroundJobEventStreamEvent => {
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
          return error instanceof BackgroundJobEventMessageDecodeError
            ? E.void
            : connectionFailures.onFailure(Cause.fail(error)).pipe(E.asVoid);
        }),
        E.retry({
          schedule: Schedule.spaced(reconnectDelay),
          while: (error) => {
            return !(error instanceof BackgroundJobEventMessageDecodeError);
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

export function makeBackgroundJobEventStream(): Stream.Stream<
  BackgroundJobEventStreamEvent,
  BackgroundJobEventStreamError,
  Socket.WebSocketConstructor
> {
  return makeBackgroundJobEventStreamForUrl(
    getApiWebSocketUrl(ROUTES.backgroundJobEvents),
  );
}
