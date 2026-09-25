import * as Clock from "effect/Clock";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { makeRequestPacer } from "@frt/api/services/fellowship-logs-gateway/make-request-pacer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("makeRequestPacer", () => {
  test("leaves the minimum interval between requests", async () => {
    const startedAt = await runTest(
      E.gen(function* () {
        const pace = yield* makeRequestPacer("500 millis");
        const request = pace(Clock.currentTimeMillis);

        const fiber = yield* E.all([request, request, request]).pipe(
          E.forkChild,
        );

        yield* TestClock.adjust("1 second");

        return yield* Fiber.join(fiber);
      }).pipe(E.provide(TestClock.layer())),
    );

    expect(startedAt).toEqual([0, 500, 1000]);
  });

  test("doesn't delay a request after a quiet spell", async () => {
    const startedAt = await runTest(
      E.gen(function* () {
        const pace = yield* makeRequestPacer("500 millis");

        const first = yield* pace(Clock.currentTimeMillis);

        yield* TestClock.adjust("2 seconds");

        const second = yield* pace(Clock.currentTimeMillis);

        return [first, second];
      }).pipe(E.provide(TestClock.layer())),
    );

    expect(startedAt).toEqual([0, 2000]);
  });
});
