import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { WebSocketChannel } from "@frt/api/api/websocket/websocket-channel-service.ts";
import { type FellowshipTrackerStatus } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { BackgroundJobMock } from "@frt/api/tests/common/mocks/background-job-mock.ts";
import { makeFellowshipTrackerMock } from "@frt/api/tests/common/mocks/fellowship-tracker-mock.ts";
import { LiveSplitMock } from "@frt/api/tests/common/mocks/live-split-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const MOCK_TIMEOUT = "1 second";

const IDLE_STATUS: FellowshipTrackerStatus = {
  _tag: "Idle",
};

type RecordingFeed = {
  readonly starts: Ref.Ref<number>;
  readonly statusChanges: Stream.Stream<FellowshipTrackerStatus>;
  readonly stops: Ref.Ref<number>;
};

function makeRecordingFeed(
  afterFirstStatus: (start: number) => Stream.Stream<never> = () => {
    return Stream.never;
  },
) {
  return E.gen(function* () {
    const starts = yield* Ref.make(0);
    const stops = yield* Ref.make(0);

    const statusChanges = Stream.unwrap(
      Ref.updateAndGet(starts, (count) => {
        return count + 1;
      }).pipe(
        E.map((start) => {
          return Stream.make(IDLE_STATUS).pipe(
            Stream.concat(afterFirstStatus(start)),
          );
        }),
      ),
    ).pipe(
      Stream.ensuring(
        Ref.update(stops, (count) => {
          return count + 1;
        }),
      ),
    );

    return {
      starts,
      statusChanges,
      stops,
    } satisfies RecordingFeed;
  });
}

function makeWebSocketChannelTestLayer({ statusChanges }: RecordingFeed) {
  return WebSocketChannel.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        BackgroundJobMock,
        LiveSplitMock,
        makeFellowshipTrackerMock({
          statusChanges,
        }),
      ),
    ),
  );
}

function takeFirstTrackingMessage(
  webSocketChannel: WebSocketChannel["Service"],
) {
  return webSocketChannel.messages("tracking").pipe(
    Stream.take(1),
    Stream.runCollect,
    E.map((messages) => {
      return Array.from(messages);
    }),
    E.timeout(MOCK_TIMEOUT),
  );
}

describe("WebSocketChannel", () => {
  test("starts a channel's feed on the first subscriber and shares it", async () => {
    const program = E.gen(function* () {
      const feed = yield* makeRecordingFeed();

      yield* E.gen(function* () {
        const webSocketChannel = yield* WebSocketChannel;

        expect(yield* Ref.get(feed.starts)).toBe(0);

        const [firstMessages, secondMessages] = yield* E.all(
          [
            takeFirstTrackingMessage(webSocketChannel),
            takeFirstTrackingMessage(webSocketChannel),
          ],
          {
            concurrency: "unbounded",
          },
        );

        expect(firstMessages).toHaveLength(1);
        expect(secondMessages).toEqual(firstMessages);
        expect(yield* Ref.get(feed.starts)).toBe(1);
      }).pipe(
        E.provide(
          makeWebSocketChannelTestLayer(feed).pipe(
            Layer.provideMerge(TestClock.layer()),
          ),
        ),
      );
    });

    await runTest(program);
  });

  test("stops a channel's feed only after the idle time to live", async () => {
    const program = E.gen(function* () {
      const feed = yield* makeRecordingFeed();

      yield* E.gen(function* () {
        const webSocketChannel = yield* WebSocketChannel;

        yield* takeFirstTrackingMessage(webSocketChannel);

        yield* TestClock.adjust("4 seconds");

        expect(yield* Ref.get(feed.stops)).toBe(0);

        yield* takeFirstTrackingMessage(webSocketChannel);

        expect(yield* Ref.get(feed.starts)).toBe(1);

        yield* TestClock.adjust("5 seconds");

        expect(yield* Ref.get(feed.stops)).toBe(1);

        yield* takeFirstTrackingMessage(webSocketChannel);

        expect(yield* Ref.get(feed.starts)).toBe(2);
      }).pipe(
        E.provide(
          makeWebSocketChannelTestLayer(feed).pipe(
            Layer.provideMerge(TestClock.layer()),
          ),
        ),
      );
    });

    await runTest(program);
  });

  test("ends subscribers and starts a fresh feed when a channel's feed ends", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const endFeed = yield* Deferred.make<void>();

        const feed = yield* makeRecordingFeed((start) => {
          return start === 1
            ? Deferred.await(endFeed).pipe(Stream.fromEffect, Stream.drain)
            : Stream.never;
        });

        yield* E.gen(function* () {
          const webSocketChannel = yield* WebSocketChannel;
          const receivedFirst = yield* Deferred.make<void>();

          const subscriberFiber = yield* webSocketChannel
            .messages("tracking")
            .pipe(
              Stream.tap(() => {
                return Deferred.succeed(receivedFirst, undefined);
              }),
              Stream.runCollect,
              E.timeout(MOCK_TIMEOUT),
              E.forkScoped,
            );

          yield* Deferred.await(receivedFirst).pipe(E.timeout(MOCK_TIMEOUT));

          yield* Deferred.succeed(endFeed, undefined);

          const messages = yield* Fiber.join(subscriberFiber);

          expect(Array.from(messages)).toHaveLength(1);

          yield* takeFirstTrackingMessage(webSocketChannel);

          expect(yield* Ref.get(feed.starts)).toBe(2);
        }).pipe(E.provide(makeWebSocketChannelTestLayer(feed)));
      }),
    );

    await runTest(program);
  });
});
