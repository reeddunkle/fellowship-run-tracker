import * as E from "effect/Effect";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { parseFellowshipEventStream } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";

const INVALID_ABILITY_LINE =
  "2026-08-19T22:35:03.174-04:00|ABILITY_ACTIVATED|not-enough-fields";

const INVALID_UNIT_DEATH_LINE =
  "2026-08-19T22:35:03.174-04:00|UNIT_DEATH|not-enough-fields";

function parseAndCaptureLevels(lines: ReadonlyArray<string>) {
  const levels: Array<string> = [];

  const captureLogger = Logger.make((options) => {
    levels.push(options.logLevel);
  });

  return E.runPromise(
    Stream.fromIterable(lines).pipe(
      parseFellowshipEventStream,
      Stream.runCollect,
      E.provide(Logger.layer([captureLogger])),
      E.provideService(References.MinimumLogLevel, "Debug"),
    ),
  ).then(() => levels);
}

describe("parseFellowshipEventStream", () => {
  test("warns once per event type and logs every invalid line at debug", async () => {
    const levels = await parseAndCaptureLevels([
      INVALID_ABILITY_LINE,
      INVALID_ABILITY_LINE,
      INVALID_ABILITY_LINE,
      INVALID_UNIT_DEATH_LINE,
    ]);

    expect(levels.filter((level) => level === "Warn")).toHaveLength(2);
    expect(levels.filter((level) => level === "Debug")).toHaveLength(4);
    expect(levels).not.toContain("Error");
  });
});
