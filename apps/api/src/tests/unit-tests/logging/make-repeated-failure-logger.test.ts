import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import { describe, expect, test } from "vitest";

import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

type CapturedLog = {
  readonly level: string;
  readonly message: unknown;
};

function captureLogs<A>(effect: E.Effect<A>) {
  const logs: Array<CapturedLog> = [];

  const captureLogger = Logger.make((options) => {
    logs.push({ level: options.logLevel, message: options.message });
  });

  return E.runPromise(
    effect.pipe(
      E.provide(Logger.layer([captureLogger])),
      E.provideService(References.MinimumLogLevel, "Debug"),
    ),
  ).then((value) => {
    return { logs, value };
  });
}

describe("makeRepeatedFailureLogger", () => {
  test("logs the first failure at its level, repeats at debug, and recovery at info", async () => {
    const { logs, value } = await captureLogs(
      E.gen(function* () {
        const failures = yield* makeRepeatedFailureLogger({
          level: "Warn",
          message: "Loop failed.",
        });

        const counts = [
          yield* failures.onFailure(Cause.fail("first")),
          yield* failures.onFailure(Cause.fail("second")),
        ];

        yield* failures.onSuccess;
        yield* failures.onSuccess;

        return counts;
      }),
    );

    expect(value).toEqual([1, 2]);
    expect(
      logs.map(({ level, message }) => {
        return [level, Array.isArray(message) ? message[0] : message];
      }),
    ).toEqual([
      ["Warn", "Loop failed."],
      ["Debug", "Loop failed."],
      ["Info", "Recovered after repeated failures."],
    ]);
  });

  test("waits for the threshold before logging at the configured level", async () => {
    const { logs } = await captureLogs(
      E.gen(function* () {
        const failures = yield* makeRepeatedFailureLogger({
          level: "Warn",
          message: "Connection lost.",
          threshold: 3,
        });

        yield* failures.onFailure(Cause.fail("one"));
        yield* failures.onFailure(Cause.fail("two"));
        yield* failures.onSuccess;
        yield* failures.onFailure(Cause.fail("one"));
        yield* failures.onFailure(Cause.fail("two"));
        yield* failures.onFailure(Cause.fail("three"));
        yield* failures.onFailure(Cause.fail("four"));
        yield* failures.onSuccess;
      }),
    );

    expect(logs.map(({ level }) => level)).toEqual([
      "Debug",
      "Debug",
      "Debug",
      "Debug",
      "Warn",
      "Debug",
      "Info",
    ]);
  });

  test("logs at the configured level again after recovering", async () => {
    const { logs } = await captureLogs(
      E.gen(function* () {
        const failures = yield* makeRepeatedFailureLogger({
          level: "Error",
          message: "Loop failed.",
        });

        yield* failures.onFailure(Cause.fail("first"));
        yield* failures.onSuccess;
        yield* failures.onFailure(Cause.fail("again"));
      }),
    );

    expect(logs.map(({ level }) => level)).toEqual(["Error", "Info", "Error"]);
  });
});
