import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { FellowshipTrackerAlreadyRunningError } from "@/errors/fellowship-tracker-error.ts";
import { makeFellowshipTrackerTestHarness } from "@/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("FellowshipTracker", () => {
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
          configurationDefinitionId: harness.configurationDefinitionId,
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
        configurationDefinitionId: result.configurationDefinitionId,
        configurationId: result.configurationId,
      },
    });

    expect(result.trackingStatus).toEqual({
      _tag: "Tracking",
      dungeonId: result.dungeonId,
      source: {
        _tag: "Persisted",
        configurationDefinitionId: result.configurationDefinitionId,
        configurationId: result.configurationId,
      },
    });
  });

  test("fails when starting while already tracking", async () => {
    const result = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        yield* Deferred.await(harness.trackingStarted);

        return yield* E.result(
          tracker.start({
            configurationId: harness.configurationId,
          }),
        );
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(
        FellowshipTrackerAlreadyRunningError,
      );
    }
  });

  test("interrupts the tracking fiber when stopped", async () => {
    await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        yield* Deferred.await(harness.trackingStarted);

        yield* tracker.stop();

        yield* Deferred.await(harness.trackingInterrupted);
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);
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

  test("does not transition to failed when stopped", async () => {
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

  test("does nothing when stopped while idle", async () => {
    const status = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

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
        configurationDefinitionId: expect.any(String),
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
        configurationDefinitionId: expect.any(String),
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

  test("allows only one concurrent start", async () => {
    const results = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      return yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        return yield* E.all(
          [
            tracker
              .start({
                configurationId: harness.configurationId,
              })
              .pipe(E.result),
            tracker
              .start({
                configurationId: harness.configurationId,
              })
              .pipe(E.result),
          ],
          {
            concurrency: "unbounded",
          },
        );
      }).pipe(E.provide(harness.layer));
    }).pipe(E.scoped, runTest);

    const successes = results.filter(Result.isSuccess);
    const failures = results.filter(Result.isFailure);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const [failure] = failures;

    if (failure !== undefined) {
      expect(failure.failure).toBeInstanceOf(
        FellowshipTrackerAlreadyRunningError,
      );
    }
  });

  test("interrupts the tracking fiber when the service scope closes", async () => {
    const trackingInterrupted = await E.gen(function* () {
      const harness = yield* makeFellowshipTrackerTestHarness();

      yield* E.gen(function* () {
        const tracker = yield* FellowshipTracker;

        yield* tracker.start({
          configurationId: harness.configurationId,
        });

        yield* Deferred.await(harness.trackingStarted);
      }).pipe(E.provide(harness.layer));

      return harness.trackingInterrupted;
    }).pipe(E.scoped, runTest);

    await Deferred.await(trackingInterrupted).pipe(runTest);
  });
});
