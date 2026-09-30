import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  DUNGEON_START_CONFIGURATION,
  DUNGEON_START_EVENTS,
} from "@frt/api/tests/common/fixtures/dungeon-start-fixtures.ts";
import { makeFellowshipTrackerTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const REPLAY_TIMEOUT = "1 second";

describe("FellowshipTracker replay", () => {
  test("stops replaying when the replay caller is interrupted", async () => {
    const result = await E.gen(function* () {
      const replayStarted = yield* Deferred.make<void>();
      const replayInterrupted = yield* Deferred.make<void>();

      const harness = yield* makeFellowshipTrackerTestHarness({
        replayEvents: Stream.fromEffect(
          Deferred.succeed(replayStarted, undefined).pipe(
            E.andThen(E.never),
            E.onInterrupt(() => {
              return Deferred.succeed(replayInterrupted, undefined);
            }),
          ),
        ),
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        const replay = yield* tracker
          .replayLog({
            configuration: harness.configuration,
            logFilePath: "replay.txt",
          })
          .pipe(E.forkChild);

        yield* Deferred.await(replayStarted);

        yield* Fiber.interrupt(replay);

        yield* Deferred.await(replayInterrupted).pipe(
          E.timeout(REPLAY_TIMEOUT),
        );

        return yield* E.result(
          tracker.start({
            configurationId: harness.configurationId,
          }),
        );
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(Result.isSuccess(result)).toBe(true);
  });

  test("interrupts the dungeon run when a replayed log ends mid-run", async () => {
    const lastMessage = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness({
        configuration: DUNGEON_START_CONFIGURATION,
        replayEvents: DUNGEON_START_EVENTS,
      });

      yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.replayLog({
          configuration: harness.configuration,
          logFilePath: "replay.txt",
        });
      }).pipe(E.provide(harness.layer));

      return yield* harness.getLastBroadcastMessage;
    }).pipe(E.scoped, runTest);

    expect(lastMessage).toMatchObject({
      state: {
        dungeonRun: {
          endedAtMilliseconds: expect.any(Number),
          status: "INTERRUPTED",
        },
      },
    });
  });
});
