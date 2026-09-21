import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { DungeonDAO } from "@/db/daos/dungeon/dungeon-dao.ts";
import {
  MOCK_ALTERNATE_DUNGEON_ID,
  MOCK_DUNGEON_ID,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";

const UNKNOWN_DUNGEON_ID = "999999";

function getDungeon<T>(dungeon: Option.Option<T>): T {
  if (Option.isNone(dungeon)) {
    throw new Error("Expected dungeon to exist.");
  }

  return dungeon.value;
}

describe("DungeonDAO", () => {
  test("returns all seeded dungeons", async () => {
    const program = E.gen(function* () {
      const dungeonDAO = yield* DungeonDAO;

      const dungeons = yield* dungeonDAO.getAll();

      expect(dungeons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: MOCK_ALTERNATE_DUNGEON_ID,
            mapId: "1",
            name: "Cithrel's Fall",
          }),
          expect.objectContaining({
            id: MOCK_DUNGEON_ID,
            mapId: "26",
            name: "Everdawn Grove",
          }),
        ]),
      );
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns a dungeon by id", async () => {
    const program = E.gen(function* () {
      const dungeonDAO = yield* DungeonDAO;

      const result = yield* dungeonDAO.getById({
        id: MOCK_DUNGEON_ID,
      });

      const dungeon = getDungeon(result);

      expect(dungeon).toMatchObject({
        id: MOCK_DUNGEON_ID,
        mapId: "26",
        name: "Everdawn Grove",
      });

      expect(DateTime.isUtc(dungeon.createdAt)).toBe(true);
      expect(DateTime.isUtc(dungeon.updatedAt)).toBe(true);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns none for an unknown dungeon id", async () => {
    const program = E.gen(function* () {
      const dungeonDAO = yield* DungeonDAO;

      const result = yield* dungeonDAO.getById({
        id: UNKNOWN_DUNGEON_ID,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });
});
