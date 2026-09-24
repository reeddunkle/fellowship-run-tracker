import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { makeTestDatabaseOptions } from "@frt/db/tests/common/make-test-database-options.ts";

describe("PersistenceLayer", () => {
  test("syncs catalog tables", async () => {
    const program = E.gen(function* () {
      const sql = yield* MainDatabase;

      const dungeons = yield* sql<{
        readonly createdAt: number;
        readonly id: string;
        readonly mapId: string;
        readonly name: string;
        readonly updatedAt: number;
      }>`
        SELECT
          created_at,
          id,
          map_id,
          name,
          updated_at
        FROM
          dungeon
        WHERE
          id = '11'
      `;

      const abilities = yield* sql<{
        readonly createdAt: number;
        readonly id: string;
        readonly name: string;
        readonly updatedAt: number;
      }>`
        SELECT
          created_at,
          id,
          name,
          updated_at
        FROM
          ability
        WHERE
          id = '634'
      `;

      const abilityUnits = yield* sql<{
        readonly abilityId: string;
        readonly createdAt: number;
        readonly unitId: string;
        readonly updatedAt: number;
      }>`
        SELECT
          ability_id,
          created_at,
          unit_id,
          updated_at
        FROM
          ability_unit
        WHERE
          ability_id = '634'
      `;

      const encounters = yield* sql<{
        readonly createdAt: number;
        readonly dungeonId: string;
        readonly id: string;
        readonly name: string;
        readonly updatedAt: number;
      }>`
        SELECT
          created_at,
          dungeon_id,
          id,
          name,
          updated_at
        FROM
          encounter
        WHERE
          dungeon_id = '24'
          AND id = '33'
      `;

      const chicken = yield* sql<{
        readonly createdAt: number;
        readonly groupKey: string | null;
        readonly id: string;
        readonly name: string;
        readonly status: string;
        readonly updatedAt: number;
        readonly variant: string | null;
      }>`
        SELECT
          created_at,
          group_key,
          id,
          name,
          status,
          updated_at,
          variant
        FROM
          unit
        WHERE
          id = '276'
      `;

      const inactiveUnit = yield* sql<{
        readonly id: string;
        readonly status: string;
      }>`
        SELECT
          id,
          status
        FROM
          unit
        WHERE
          id = '282'
      `;

      const unitCount = yield* sql<{ readonly count: number }>`
        SELECT
          COUNT(*) AS count
        FROM
          unit
      `;

      const dungeonUnitCount = yield* sql<{ readonly count: number }>`
        SELECT
          COUNT(*) AS count
        FROM
          dungeon_unit
      `;

      const abilityUnitCount = yield* sql<{ readonly count: number }>`
        SELECT
          COUNT(*) AS count
        FROM
          ability_unit
      `;

      const catalogSyncCount = yield* sql<{ readonly count: number }>`
        SELECT
          COUNT(*) AS count
        FROM
          catalog_sync
      `;

      expect(dungeons).toEqual([
        {
          createdAt: expect.any(Number),
          id: "11",
          mapId: "26",
          name: "Everdawn Grove",
          updatedAt: expect.any(Number),
        },
      ]);

      expect(abilities).toEqual([
        {
          createdAt: expect.any(Number),
          id: "634",
          name: "Stormy Retreat",
          updatedAt: expect.any(Number),
        },
      ]);

      expect(abilityUnits).toEqual([
        {
          abilityId: "634",
          createdAt: expect.any(Number),
          unitId: "133",
          updatedAt: expect.any(Number),
        },
      ]);

      expect(encounters).toEqual([
        {
          createdAt: expect.any(Number),
          dungeonId: "24",
          id: "33",
          name: "Vexira",
          updatedAt: expect.any(Number),
        },
      ]);

      expect(chicken).toEqual([
        {
          createdAt: expect.any(Number),
          groupKey: "CHICKEN",
          id: "276",
          name: "Chicken",
          status: "ACTIVE",
          updatedAt: expect.any(Number),
          variant: "Small",
        },
      ]);

      expect(inactiveUnit).toEqual([
        {
          id: "282",
          status: "INACTIVE",
        },
      ]);

      expect(unitCount[0]?.count).toBeGreaterThan(0);
      expect(dungeonUnitCount[0]?.count).toBeGreaterThan(0);
      expect(abilityUnitCount[0]?.count).toBeGreaterThan(0);

      expect(catalogSyncCount).toEqual([
        {
          count: 4,
        },
      ]);
    }).pipe(E.provide(makePersistenceLayer(makeTestDatabaseOptions())));

    await runTest(program);
  });
});
