import * as Cause from "effect/Cause";
import type * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";

import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";

export type ApiEventStreamEvent<Message> =
  | {
      readonly state: ApiEventConnectionState;
      readonly type: "CONNECTION_STATE_CHANGED";
    }
  | {
      readonly message: Message;
      readonly type: "MESSAGE_RECEIVED";
    };

export type ApiEventStreamError<DecodeError> = DecodeError | Socket.SocketError;

export type MakeApiEventStreamOptions<Message, DecodeError> = {
  readonly connectionLostMessage: string;
  readonly makeDecodeError: (cause: Schema.SchemaError) => DecodeError;
  readonly reconnectDelay?: Duration.Input;
  readonly schema: Schema.Codec<Message, unknown>;
  readonly url: string;
};

const DEFAULT_RECONNECT_DELAY = "1 second";

const RECONNECT_WARNING_THRESHOLD = 3;

function isCleanClose(error: unknown): error is Socket.SocketError {
  return (
    Socket.isSocketError(error) &&
    error.reason._tag === "SocketCloseError" &&
    error.reason.code === 1000
  );
}

function offerConnectionState<Message>(
  queue: Queue.Enqueue<ApiEventStreamEvent<Message>>,
  state: ApiEventConnectionState,
) {
  return Queue.offer(queue, {
    state,
    type: "CONNECTION_STATE_CHANGED",
  });
}

export function makeApiEventStream<Message, DecodeError>({
  connectionLostMessage,
  makeDecodeError,
  reconnectDelay = DEFAULT_RECONNECT_DELAY,
  schema,
  url,
}: MakeApiEventStreamOptions<Message, DecodeError>): Stream.Stream<
  ApiEventStreamEvent<Message>,
  ApiEventStreamError<DecodeError>,
  Socket.WebSocketConstructor
> {
  const decodeMessageEffect = Schema.decodeEffect(
    Schema.fromJsonString(schema),
  );

  const decodeMessage = (message: string): E.Effect<Message, DecodeError> => {
    return decodeMessageEffect(message).pipe(E.mapError(makeDecodeError));
  };

  return Stream.callback<
    ApiEventStreamEvent<Message>,
    ApiEventStreamError<DecodeError>,
    Socket.WebSocketConstructor
  >((queue) => {
    return E.gen(function* () {
      const connectionFailures = yield* makeRepeatedFailureLogger({
        level: "Warn",
        message: connectionLostMessage,
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
              messages.map((message): ApiEventStreamEvent<Message> => {
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
        E.catchIf(isCleanClose, () => {
          return E.void;
        }),
        E.scoped,
        E.ensuring(
          offerConnectionState(queue, API_EVENT_CONNECTION_STATE.DISCONNECTED),
        ),
      );

      return yield* connect.pipe(
        E.tapError((error) => {
          return Socket.isSocketError(error)
            ? connectionFailures.onFailure(Cause.fail(error)).pipe(E.asVoid)
            : E.void;
        }),
        E.retry({
          schedule: Schedule.spaced(reconnectDelay),
          while: Socket.isSocketError,
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
