import * as ByteSize from "effect/ByteSize";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import {
  FellowshipTracker,
  type FellowshipTrackerShape,
  type FellowshipTrackerStatus,
} from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type FellowshipLiveLogItem } from "@frt/api/services/fellowship/fellowship-live-log.ts";
import { TEST_LIVE_LOG_FILE_PATH } from "@frt/api/tests/common/harnesses/fellowship-test-harness.ts";
import { makeFellowshipTrackerTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const awaitStatus = (
  tracker: FellowshipTrackerShape,
  tag: FellowshipTrackerStatus["_tag"],
) => {
  return tracker.statusChanges.pipe(
    Stream.filter((status) => {
      return status._tag === tag;
    }),
    Stream.runHead,
    E.flatMap((status) => {
      return Option.match(status, {
        onNone: () => {
          return E.die(`Expected FellowshipTracker to report ${tag}.`);
        },
        onSome: E.succeed,
      });
    }),
  );
};

describe("FellowshipTracker status", () => {
  test("starts idle", async () => {
    const status = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        return yield* tracker.status;
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(status).toEqual({
      _tag: "Idle",
    });
  });

  test("follows the live log from starting to waiting for a log file to tracking", async () => {
    const result = await E.gen(function* () {
      const liveLogItems = yield* Queue.make<FellowshipLiveLogItem>();

      const harness = yield* makeFellowshipTrackerTestHarness({
        liveLog: Stream.fromQueue(liveLogItems),
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        const startingStatus = yield* tracker.status;

        yield* Queue.offer(liveLogItems, {
          _tag: "WaitingForLogFile",
        });

        const waitingStatus = yield* awaitStatus(tracker, "WaitingForLogFile");

        yield* Queue.offer(liveLogItems, {
          _tag: "AttachedLogFile",
          filePath: TEST_LIVE_LOG_FILE_PATH,
          startOffset: ByteSize.bytes(0),
        });

        const trackingStatus = yield* awaitStatus(tracker, "Tracking");

        yield* Queue.offer(liveLogItems, {
          _tag: "WaitingForLogFile",
        });

        const waitingAgainStatus = yield* awaitStatus(
          tracker,
          "WaitingForLogFile",
        );

        return {
          configurationId: harness.configurationId,
          dungeonId: harness.configuration.dungeonId,
          startingStatus,
          trackingStatus,
          waitingAgainStatus,
          waitingStatus,
        };
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    const statusContext = {
      dungeonId: result.dungeonId,
      source: {
        _tag: "Persisted",
        configurationId: result.configurationId,
      },
    } as const;

    expect(result.startingStatus).toEqual({
      _tag: "Starting",
      ...statusContext,
    });

    expect(result.waitingStatus).toEqual({
      _tag: "WaitingForLogFile",
      ...statusContext,
    });

    expect(result.trackingStatus).toEqual({
      _tag: "Tracking",
      ...statusContext,
    });

    expect(result.waitingAgainStatus).toEqual({
      _tag: "WaitingForLogFile",
      ...statusContext,
    });
  });

  test("returns to idle after stopping", async () => {
    const status = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        yield* Deferred.await(harness.trackingStarted);

        yield* tracker.stop();

        return yield* tracker.status;
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(status).toEqual({
      _tag: "Idle",
    });
  });

  test("returns to idle when the tracking effect completes", async () => {
    const status = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness({
        liveLog: Stream.empty,
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        const idleStatusFiber = yield* tracker.statusChanges.pipe(
          Stream.filter((statusChange) => {
            return statusChange._tag === "Idle";
          }),
          Stream.runHead,
          E.forkScoped,
        );

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        const idleStatusOption = yield* Fiber.join(idleStatusFiber);

        if (Option.isNone(idleStatusOption)) {
          return yield* E.die("Expected FellowshipTracker to return to Idle.");
        }

        return idleStatusOption.value;
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(status).toEqual({
      _tag: "Idle",
    });
  });
});
