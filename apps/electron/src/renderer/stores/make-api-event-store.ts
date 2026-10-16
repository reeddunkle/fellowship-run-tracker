import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import { type ApiEventStreamEvent } from "@/renderer/api/make-api-event-stream.ts";
import { makeRestartableBrowserProgram } from "@/renderer/runtimes/make-restartable-browser-program.ts";

export type ApiEventStoreSnapshot<State extends object> = State & {
  readonly eventConnectionState: ApiEventConnectionState;
};

type Listener = () => void;

export type ApiEventStore<Snapshot> = {
  readonly getSnapshot: () => Snapshot;
  readonly subscribe: (listener: Listener) => () => void;
};

export type ManualApiEventStore<Snapshot> = ApiEventStore<Snapshot> & {
  readonly start: () => void;
  readonly stop: () => void;
};

export type ApiEventStoreLifecycle = "manual" | "while-subscribed";

export type ApiEventStoreMessageChange<Message, State extends object> = {
  readonly message: Message;
  readonly next: ApiEventStoreSnapshot<State>;
  readonly previous: ApiEventStoreSnapshot<State>;
};

export type MakeApiEventStoreOptions<
  Message,
  State extends object,
  StreamError,
  Lifecycle extends ApiEventStoreLifecycle,
> = {
  readonly initialState: State;
  readonly label: string;
  readonly lifecycle: Lifecycle;
  readonly makeEventStream: () => Stream.Stream<
    ApiEventStreamEvent<Message>,
    StreamError,
    Socket.WebSocketConstructor
  >;
  readonly onMessage?: (
    change: ApiEventStoreMessageChange<Message, State>,
  ) => E.Effect<void>;
  readonly reduce?: (state: State, message: Message) => State;
};

export function makeApiEventStore<Message, State extends object, StreamError>(
  options: MakeApiEventStoreOptions<Message, State, StreamError, "manual">,
): ManualApiEventStore<ApiEventStoreSnapshot<State>>;
export function makeApiEventStore<Message, State extends object, StreamError>(
  options: MakeApiEventStoreOptions<
    Message,
    State,
    StreamError,
    "while-subscribed"
  >,
): ApiEventStore<ApiEventStoreSnapshot<State>>;
export function makeApiEventStore<Message, State extends object, StreamError>({
  initialState,
  label,
  lifecycle,
  makeEventStream,
  onMessage,
  reduce,
}: MakeApiEventStoreOptions<
  Message,
  State,
  StreamError,
  ApiEventStoreLifecycle
>):
  | ApiEventStore<ApiEventStoreSnapshot<State>>
  | ManualApiEventStore<ApiEventStoreSnapshot<State>> {
  let snapshot: ApiEventStoreSnapshot<State> = {
    ...initialState,
    eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
  };

  const listeners = new Set<Listener>();

  function setSnapshot(nextSnapshot: ApiEventStoreSnapshot<State>): void {
    snapshot = nextSnapshot;

    listeners.forEach((listener) => {
      listener();
    });
  }

  function setConnectionState(
    eventConnectionState: ApiEventConnectionState,
  ): E.Effect<void> {
    return E.sync(() => {
      setSnapshot({
        ...snapshot,
        eventConnectionState,
      });
    });
  }

  const receiveMessage = E.fnUntraced(function* (message: Message) {
    const previous = snapshot;

    if (reduce !== undefined) {
      setSnapshot({
        ...reduce(previous, message),
        eventConnectionState: previous.eventConnectionState,
      });
    }

    if (onMessage !== undefined) {
      yield* onMessage({
        message,
        next: snapshot,
        previous,
      });
    }
  });

  const handleEvent = Match.type<ApiEventStreamEvent<Message>>().pipe(
    Match.discriminatorsExhaustive("type")({
      CONNECTION_STATE_CHANGED: (event) => {
        return setConnectionState(event.state);
      },
      MESSAGE_RECEIVED: (event) => {
        return receiveMessage(event.message);
      },
    }),
  );

  const { start, stop } = makeRestartableBrowserProgram(() => {
    return makeEventStream().pipe(
      Stream.runForEach(handleEvent),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError(`${label} event stream failed.`, {
            error,
          });

          yield* setConnectionState(API_EVENT_CONNECTION_STATE.ERROR);
        });
      }),
    );
  });

  const isWhileSubscribed = lifecycle === "while-subscribed";

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    if (isWhileSubscribed && listeners.size === 1) {
      start();
    }

    return () => {
      listeners.delete(listener);

      if (isWhileSubscribed && listeners.size === 0) {
        stop();
      }
    };
  }

  function getSnapshot(): ApiEventStoreSnapshot<State> {
    return snapshot;
  }

  if (isWhileSubscribed) {
    return {
      getSnapshot,
      subscribe,
    };
  }

  return {
    getSnapshot,
    start,
    stop,
    subscribe,
  };
}
