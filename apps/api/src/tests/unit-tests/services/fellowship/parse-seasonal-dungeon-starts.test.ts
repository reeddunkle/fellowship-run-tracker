import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { parseFellowshipLogLine } from "@frt/api/services/fellowship/parsing/parse-fellowship-log-line.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const NEW_SEASON_START_LINES = [
  '2026-10-22T09:14:45.799-04:00|DUNGEON_START|"Silken Hollow"|24|1|[23,29]|2|2026-10-22T09:14:44.203-04:00|',
  '2026-10-22T09:29:14.177-04:00|DUNGEON_START|"Stormwatch"|12|1|[23,29]|2|2026-10-22T09:29:12.592-04:00|',
  '2026-10-22T09:37:15.405-04:00|DUNGEON_START|"Scryer\'s Peak"|31|1|[23,29,15]|3|2026-10-22T09:37:13.865-04:00|',
  '2026-10-22T09:48:01.525-04:00|DUNGEON_START|"Scryer\'s Peak"|31|1|[23,29]|2|2026-10-22T09:47:59.965-04:00|',
  '2026-10-22T10:12:29.303-04:00|DUNGEON_START|"Empyrean Sands"|6|1|[29,23,12,14]|4|2026-10-22T10:12:27.769-04:00|',
  '2026-10-22T10:23:33.155-04:00|DUNGEON_START|"Scryer\'s Peak"|31|1|[29,23,14,25]|4|2026-10-22T10:23:31.649-04:00|',
  '2026-10-22T10:38:40.551-04:00|DUNGEON_START|"Ruins of Regath"|29|1|[29,23,11,14]|4|2026-10-22T10:38:39.064-04:00|',
  '2026-10-22T10:50:08.366-04:00|DUNGEON_START|"Crown of the Wild"|36|1|[29,23,25,11]|4|2026-10-22T10:50:06.898-04:00|',
  '2026-10-22T11:01:32.472-04:00|DUNGEON_START|"Urrak Markets"|21|1|[29,23,8,25]|4|2026-10-22T11:01:31.033-04:00|',
];

describe("seasonal dungeon start parsing", () => {
  test("decodes the observed Adventure difficulty pools", async () => {
    const events = await runTest(
      E.forEach(NEW_SEASON_START_LINES, parseFellowshipLogLine),
    );

    expect(events).toHaveLength(9);
    expect(
      events.map((event) => {
        return event?.type === "DUNGEON_START"
          ? {
              category: event.dungeonCategory,
              difficulty: event.adventureDifficulty,
              level: event.dungeonLevel,
            }
          : undefined;
      }),
    ).toEqual([
      { category: "ADVENTURE", difficulty: "EASY", level: 1 },
      { category: "ADVENTURE", difficulty: "EASY", level: 1 },
      { category: "ADVENTURE", difficulty: "MEDIUM", level: 1 },
      { category: "ADVENTURE", difficulty: "EASY", level: 1 },
      { category: "ADVENTURE", difficulty: "HARD", level: 1 },
      { category: "ADVENTURE", difficulty: "HARD", level: 1 },
      { category: "ADVENTURE", difficulty: "HARD", level: 1 },
      { category: "ADVENTURE", difficulty: "HARD", level: 1 },
      { category: "ADVENTURE", difficulty: "HARD", level: 1 },
    ]);
  });

  test("preserves the legacy Eternal level offset", async () => {
    const event = await runTest(
      parseFellowshipLogLine(
        '2026-08-19T22:35:02.873-04:00|DUNGEON_START|"Everdawn Grove"|11|84|[4,6,14,19]|0|2026-08-19T22:35:03.581-04:00|',
      ),
    );

    expect(event).toMatchObject({
      adventureDifficulty: undefined,
      dungeonCategory: "ETERNAL",
      dungeonLevel: 64,
    });
  });
});
