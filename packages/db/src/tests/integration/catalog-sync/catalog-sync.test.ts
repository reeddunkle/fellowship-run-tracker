import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { DungeonDAO } from "@frt/db/daos/dungeon/dungeon-dao.ts";
import { EncounterDAO } from "@frt/db/daos/encounter/encounter-dao.ts";
import { UnitDAO } from "@frt/db/daos/unit/unit-dao.ts";
import { getSome } from "@frt/db/tests/common/get-some.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

describe("catalog synchronization", () => {
  test("makes the effective seasonal catalog available from a clean database", async () => {
    const program = E.gen(function* () {
      const dungeonDAO = yield* DungeonDAO;
      const encounterDAO = yield* EncounterDAO;
      const unitDAO = yield* UnitDAO;

      expect(getSome(yield* dungeonDAO.getById({ id: "36" }))).toMatchObject({
        id: "36",
        mapId: "41",
        name: "Crown of the Wild",
      });
      expect(
        getSome(
          yield* encounterDAO.getById({
            dungeonId: "36",
            id: "40",
          }),
        ),
      ).toMatchObject({
        dungeonId: "36",
        id: "40",
        name: "Scrofa, Wild Incarnate",
      });
      expect(getSome(yield* unitDAO.getById({ id: "346" }))).toMatchObject({
        dungeonIds: ["36"],
        id: "346",
        name: "Spear Centurion",
      });
      expect(getSome(yield* unitDAO.getById({ id: "313" }))).toMatchObject({
        id: "313",
        name: "Elder Glacial Bear",
      });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
});
