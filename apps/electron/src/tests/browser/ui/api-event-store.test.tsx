import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import { type ApiEventStreamEvent } from "@/renderer/api/make-api-event-stream.ts";
import {
  type ApiEventStoreMessageChange,
  makeApiEventStore,
} from "@/renderer/stores/make-api-event-store.ts";

type TestMessage = {
  readonly value: number;
};

type TestState = {
  readonly latestValue: number | null;
};

type TestEvent = ApiEventStreamEvent<TestMessage>;

class TestStreamError extends Data.TaggedError("TestStreamError") {}

const INITIAL_STATE: TestState = {
  latestValue: null,
};

function connectionEvent(state: ApiEventConnectionState): TestEvent {
  return {
    state,
    type: "CONNECTION_STATE_CHANGED",
  };
}

function messageEvent(value: number): TestEvent {
  return {
    message: {
      value,
    },
    type: "MESSAGE_RECEIVED",
  };
}

function reduceTestMessage(_state: TestState, message: TestMessage): TestState {
  return {
    latestValue: message.value,
  };
}

function makeManualStore(
  makeEventStream: () => Stream.Stream<TestEvent, TestStreamError>,
) {
  return makeApiEventStore({
    initialState: INITIAL_STATE,
    label: "Test",
    lifecycle: "manual",
    makeEventStream,
    reduce: reduceTestMessage,
  });
}

function makeWhileSubscribedStore(
  makeEventStream: () => Stream.Stream<TestEvent, TestStreamError>,
) {
  return makeApiEventStore({
    initialState: INITIAL_STATE,
    label: "Test",
    lifecycle: "while-subscribed",
    makeEventStream,
    reduce: reduceTestMessage,
  });
}

describe("makeApiEventStore", () => {
  test("starts with a disconnected snapshot of the initial state", () => {
    const store = makeManualStore(() => {
      return Stream.never;
    });

    expect(store.getSnapshot()).toEqual({
      eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
      latestValue: null,
    });
  });

  test("updates event connection state from the event stream", async () => {
    const store = makeManualStore(() => {
      return Stream.make(connectionEvent(API_EVENT_CONNECTION_STATE.CONNECTED));
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        eventConnectionState: API_EVENT_CONNECTION_STATE.CONNECTED,
        latestValue: null,
      });
    });
  });

  test("reduces messages into the snapshot and keeps the connection state", async () => {
    const store = makeManualStore(() => {
      return Stream.make(
        connectionEvent(API_EVENT_CONNECTION_STATE.CONNECTED),
        messageEvent(1),
        messageEvent(2),
      );
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        eventConnectionState: API_EVENT_CONNECTION_STATE.CONNECTED,
        latestValue: 2,
      });
    });
  });

  test("runs onMessage with the previous and next snapshots", async () => {
    const changes: Array<ApiEventStoreMessageChange<TestMessage, TestState>> =
      [];

    const store = makeApiEventStore({
      initialState: INITIAL_STATE,
      label: "Test",
      lifecycle: "manual",
      makeEventStream: () => {
        return Stream.make(messageEvent(1), messageEvent(2));
      },
      onMessage: (change) => {
        return E.sync(() => {
          changes.push(change);
        });
      },
      reduce: reduceTestMessage,
    });

    store.start();

    await vi.waitFor(() => {
      expect(changes).toHaveLength(2);
    });

    expect(changes[1]).toEqual({
      message: {
        value: 2,
      },
      next: {
        eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
        latestValue: 2,
      },
      previous: {
        eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
        latestValue: 1,
      },
    });
  });

  test("leaves the snapshot alone and does not notify when there is no reducer", async () => {
    const onMessage = vi.fn(() => {
      return E.void;
    });

    const store = makeApiEventStore({
      initialState: {},
      label: "Test",
      lifecycle: "manual",
      makeEventStream: () => {
        return Stream.make(messageEvent(1));
      },
      onMessage,
    });

    const initialSnapshot = store.getSnapshot();
    const listener = vi.fn();

    store.subscribe(listener);
    store.start();

    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledOnce();
    });

    expect(store.getSnapshot()).toBe(initialSnapshot);
    expect(listener).not.toHaveBeenCalled();
  });

  test("sets the event connection state to error when the event stream fails", async () => {
    const store = makeManualStore(() => {
      return Stream.make(messageEvent(1)).pipe(
        Stream.concat(Stream.fail(new TestStreamError())),
      );
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        eventConnectionState: API_EVENT_CONNECTION_STATE.ERROR,
        latestValue: 1,
      });
    });
  });

  test("notifies subscribers when the snapshot changes", async () => {
    const store = makeManualStore(() => {
      return Stream.make(
        connectionEvent(API_EVENT_CONNECTION_STATE.CONNECTING),
      );
    });

    const listener = vi.fn();

    store.subscribe(listener);
    store.start();

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  test("does not notify a subscriber after it unsubscribes", async () => {
    const store = makeManualStore(() => {
      return Stream.make(connectionEvent(API_EVENT_CONNECTION_STATE.CONNECTED));
    });

    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot().eventConnectionState).toBe(
        API_EVENT_CONNECTION_STATE.CONNECTED,
      );
    });

    expect(listener).not.toHaveBeenCalled();
  });

  describe("manual lifecycle", () => {
    test("does not start the event stream when subscribed", () => {
      const makeEventStream = vi.fn(() => {
        return Stream.never;
      });

      const store = makeManualStore(makeEventStream);

      store.subscribe(() => {});

      expect(makeEventStream).not.toHaveBeenCalled();
    });

    test("does not start another event stream while already running", () => {
      const makeEventStream = vi.fn(() => {
        return Stream.never;
      });

      const store = makeManualStore(makeEventStream);

      store.start();
      store.start();

      expect(makeEventStream).toHaveBeenCalledOnce();

      store.stop();
    });

    test("can be started again after being stopped", () => {
      const makeEventStream = vi.fn(() => {
        return Stream.never;
      });

      const store = makeManualStore(makeEventStream);

      store.start();
      store.stop();
      store.start();

      expect(makeEventStream).toHaveBeenCalledTimes(2);

      store.stop();
    });

    test("stops the restarted event stream after a quick stop and restart", async () => {
      let startedStreamCount = 0;
      let endedStreamCount = 0;
      const releaseFirstStreamFinalizer = Deferred.makeUnsafe<void>();

      const store = makeManualStore(() => {
        startedStreamCount += 1;

        const awaitRelease =
          startedStreamCount === 1
            ? Deferred.await(releaseFirstStreamFinalizer)
            : E.void;

        return Stream.never.pipe(
          Stream.ensuring(
            awaitRelease.pipe(
              E.andThen(
                E.sync(() => {
                  endedStreamCount += 1;
                }),
              ),
            ),
          ),
        );
      });

      store.start();
      store.stop();
      store.start();

      expect(startedStreamCount).toBe(2);

      Deferred.doneUnsafe(releaseFirstStreamFinalizer, E.void);

      await vi.waitFor(() => {
        expect(endedStreamCount).toBe(1);
      });

      store.stop();

      await vi.waitFor(() => {
        expect(endedStreamCount).toBe(2);
      });
    });
  });

  describe("while-subscribed lifecycle", () => {
    test("does not expose start or stop", () => {
      const store = makeWhileSubscribedStore(() => {
        return Stream.never;
      });

      expect(Object.keys(store).sort()).toEqual(["getSnapshot", "subscribe"]);
    });

    test("starts the event stream on the first subscriber only", () => {
      const makeEventStream = vi.fn(() => {
        return Stream.never;
      });

      const store = makeWhileSubscribedStore(makeEventStream);

      expect(makeEventStream).not.toHaveBeenCalled();

      const unsubscribeFirst = store.subscribe(() => {});
      const unsubscribeSecond = store.subscribe(() => {});

      expect(makeEventStream).toHaveBeenCalledOnce();

      unsubscribeFirst();
      unsubscribeSecond();
    });

    test("stops the event stream when the last subscriber leaves", async () => {
      let endedStreamCount = 0;

      const store = makeWhileSubscribedStore(() => {
        return Stream.never.pipe(
          Stream.ensuring(
            E.sync(() => {
              endedStreamCount += 1;
            }),
          ),
        );
      });

      const unsubscribeFirst = store.subscribe(() => {});
      const unsubscribeSecond = store.subscribe(() => {});

      unsubscribeFirst();

      expect(endedStreamCount).toBe(0);

      unsubscribeSecond();

      await vi.waitFor(() => {
        expect(endedStreamCount).toBe(1);
      });
    });

    test("restarts the event stream when a new subscriber arrives", () => {
      const makeEventStream = vi.fn(() => {
        return Stream.never;
      });

      const store = makeWhileSubscribedStore(makeEventStream);

      const unsubscribeFirst = store.subscribe(() => {});

      unsubscribeFirst();

      const unsubscribeSecond = store.subscribe(() => {});

      expect(makeEventStream).toHaveBeenCalledTimes(2);

      unsubscribeSecond();
    });
  });
});
