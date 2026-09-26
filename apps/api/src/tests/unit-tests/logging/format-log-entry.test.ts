import * as E from "effect/Effect";
import * as Logger from "effect/Logger";
import { describe, expect, test } from "vitest";

import { formatLogEntry } from "@frt/api/logging/format-log-entry.ts";

function captureLogEntries<A>(effect: E.Effect<A>) {
  const lines: Array<string> = [];

  const captureLogger = Logger.map(formatLogEntry, (line) => {
    lines.push(line);
  });

  return E.runPromise(
    effect.pipe(E.provide(Logger.layer([captureLogger]))),
  ).then((value) => {
    return {
      entries: lines.map((line): unknown => JSON.parse(line)),
      value,
    };
  });
}

describe("formatLogEntry", () => {
  test("adds the current span's trace and span ids", async () => {
    const { entries, value: span } = await captureLogEntries(
      E.gen(function* () {
        yield* E.logInfo("Inside a span.");

        return yield* E.currentSpan;
      }).pipe(E.orDie, E.withSpan("test-span")),
    );

    expect(entries).toEqual([
      expect.objectContaining({
        level: "INFO",
        message: "Inside a span.",
        spanId: span.spanId,
        traceId: span.traceId,
      }),
    ]);
  });

  test("writes null ids when there is no current span", async () => {
    const { entries } = await captureLogEntries(E.logInfo("No span."));

    expect(entries).toEqual([
      expect.objectContaining({ spanId: null, traceId: null }),
    ]);
  });
});
