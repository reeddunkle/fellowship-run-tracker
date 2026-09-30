import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { getFellowshipLogStartedAt } from "@frt/api/services/fellowship/parsing/get-fellowship-log-started-at.ts";

describe("getFellowshipLogStartedAt", () => {
  test("reads the timestamp of the first log line, including its offset", () => {
    const startedAt = getFellowshipLogStartedAt(
      '2026-08-19T22:35:02.873-04:00|DUNGEON_START|"Everdawn Grove"|11|84|[4,6,14,19]|0|2026-08-19T22:35:03.581-04:00|\n2026-08-19T22:35:03.174-04:00|ABILITY_ACTIVATED|',
    );

    expect(startedAt).toEqual(
      DateTime.makeUnsafe("2026-08-20T02:35:02.873Z").pipe(
        DateTime.toEpochMillis,
        Option.some,
      ),
    );
  });

  test("returns nothing while the first line's timestamp is incomplete", () => {
    expect(getFellowshipLogStartedAt("2026-08-19T22:35")).toEqual(
      Option.none(),
    );
  });

  test("returns nothing for text that does not start with a timestamp", () => {
    expect(getFellowshipLogStartedAt("not a log line|DUNGEON_START|")).toEqual(
      Option.none(),
    );
  });

  test("returns nothing for an empty file", () => {
    expect(getFellowshipLogStartedAt("")).toEqual(Option.none());
  });
});
