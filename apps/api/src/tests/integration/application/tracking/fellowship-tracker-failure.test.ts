import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { makeFellowshipTrackerTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("FellowshipTracker failures", () => {
  test("transitions to a filesystem failure when the live event stream fails", async () => {
    const fileSystemError = PlatformError.systemError({
      _tag: "Unknown",
      description: "Test Fellowship filesystem failure.",
      method: "watch",
      module: "FileSystem",
    });

    const failedStatus = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness({
        liveEvents: Stream.fail(fileSystemError),
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        const failedStatusFiber = yield* tracker.statusChanges.pipe(
          Stream.filter((status) => {
            return status._tag === "Failed";
          }),
          Stream.runHead,
          E.forkScoped,
        );

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        const failedStatusOption = yield* Fiber.join(failedStatusFiber);

        if (Option.isNone(failedStatusOption)) {
          return yield* E.die(
            "Expected FellowshipTracker to transition to Failed.",
          );
        }

        return failedStatusOption.value;
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(failedStatus).toEqual({
      _tag: "Failed",
      dungeonId: "24",
      failure: {
        _tag: "FileSystem",
      },
      source: {
        _tag: "Persisted",
        configurationId: expect.any(String),
      },
    });
  });

  test("transitions to an unexpected failure when the live event stream defects", async () => {
    const failedStatus = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness({
        liveEvents: Stream.fromEffect(
          E.die(new Error("Test Fellowship tracker defect.")),
        ),
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        const failedStatusFiber = yield* tracker.statusChanges.pipe(
          Stream.filter((status) => {
            return status._tag === "Failed";
          }),
          Stream.runHead,
          E.forkScoped,
        );

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        const failedStatusOption = yield* Fiber.join(failedStatusFiber);

        if (Option.isNone(failedStatusOption)) {
          return yield* E.die(
            "Expected FellowshipTracker to transition to Failed.",
          );
        }

        return failedStatusOption.value;
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(failedStatus).toEqual({
      _tag: "Failed",
      dungeonId: "24",
      failure: {
        _tag: "Unexpected",
      },
      source: {
        _tag: "Persisted",
        configurationId: expect.any(String),
      },
    });
  });

  test("retains failed status after the tracking fiber terminates", async () => {
    const fileSystemError = PlatformError.systemError({
      _tag: "Unknown",
      description: "Test Fellowship filesystem failure.",
      method: "watch",
      module: "FileSystem",
    });

    const result = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness({
        liveEvents: Stream.fail(fileSystemError),
      });

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        const failedStatusFiber = yield* tracker.statusChanges.pipe(
          Stream.filter((status) => {
            return status._tag === "Failed";
          }),
          Stream.runHead,
          E.forkScoped,
        );

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        const failedStatusOption = yield* Fiber.join(failedStatusFiber);

        if (Option.isNone(failedStatusOption)) {
          return yield* E.die(
            "Expected FellowshipTracker to transition to Failed.",
          );
        }

        /*
         * Give the tracking fiber an opportunity to run its finalizer.
         * The finalizer clears the active tracker but must not reset the
         * externally visible failure status to Idle.
         */
        yield* E.yieldNow;

        return {
          currentStatus: yield* tracker.status,
          failedStatus: failedStatusOption.value,
        };
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(result.currentStatus).toEqual(result.failedStatus);
    expect(result.currentStatus._tag).toBe("Failed");
  });
});
