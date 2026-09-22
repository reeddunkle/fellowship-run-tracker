import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Result from "effect/Result";
import { describe, expect, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { FellowshipTrackerAlreadyRunningError } from "@frt/api/errors/fellowship-tracker-error.ts";
import { makeFellowshipTrackerTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("FellowshipTracker start and stop", () => {
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
});
