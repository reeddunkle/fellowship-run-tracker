import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { makeFellowshipTrackerTestHarness } from "@/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

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

  test("changes from waiting for log file to tracking when a log file becomes available", async () => {
    const result = await E.gen(function* () {
      const logFileAvailable = yield* Deferred.make<void>();

      const liveStatus = Stream.concat(
        Stream.succeed({
          _tag: "WaitingForLogFile",
        } as const),
        Stream.fromEffect(
          Deferred.await(logFileAvailable).pipe(
            E.as({
              _tag: "MonitoringLogFile",
              filePath: "/logs/fellowship.txt",
            } as const),
          ),
        ),
      );

      const harness = yield* makeFellowshipTrackerTestHarness({
        liveStatus,
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        yield* Deferred.await(harness.trackingStarted);

        const waitingStatus = yield* tracker.status;

        const trackingStatusEffect = tracker.statusChanges.pipe(
          Stream.filter((status) => {
            return status._tag === "Tracking";
          }),
          Stream.runHead,
          E.forkScoped,
        );

        yield* Deferred.succeed(logFileAvailable, undefined);

        const trackingStatusFiber = yield* trackingStatusEffect;
        const trackingStatusOption = yield* Fiber.join(trackingStatusFiber);

        if (Option.isNone(trackingStatusOption)) {
          return yield* E.die(
            "Expected FellowshipTracker to transition to Tracking.",
          );
        }

        return {
          configurationId: harness.configurationId,
          dungeonId: harness.configuration.dungeonId,
          trackingStatus: trackingStatusOption.value,
          waitingStatus,
        };
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(result.waitingStatus).toEqual({
      _tag: "WaitingForLogFile",
      dungeonId: result.dungeonId,
      source: {
        _tag: "Persisted",
        configurationId: result.configurationId,
      },
    });

    expect(result.trackingStatus).toEqual({
      _tag: "Tracking",
      dungeonId: result.dungeonId,
      source: {
        _tag: "Persisted",
        configurationId: result.configurationId,
      },
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
        liveEvents: Stream.empty,
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
