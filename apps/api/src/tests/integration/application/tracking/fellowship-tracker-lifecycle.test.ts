import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import { describe, test } from "vitest";

import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { makeFellowshipTrackerTestHarness } from "@frt/api/tests/common/harnesses/fellowship-tracker-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("FellowshipTracker lifecycle", () => {
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
