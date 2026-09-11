import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { describe, expect, test } from "vitest";

import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("DatabaseLayer", () => {
  test("runs database migrations", async () => {
    const program = E.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const tables = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
            'ability',
            'ability_unit',
            'app_settings',
            'configuration',
            'configuration_definition',
            'dungeon',
            'dungeon_run',
            'dungeon_run_observation',
            'dungeon_unit',
            'encounter',
            'milestone',
            'milestone_requirement',
            'requirement',
            'unit'
          )
        ORDER BY name
      `;

      expect(tables).toEqual([
        {
          name: "ability",
        },
        {
          name: "ability_unit",
        },
        {
          name: "app_settings",
        },
        {
          name: "configuration",
        },
        {
          name: "configuration_definition",
        },
        {
          name: "dungeon",
        },
        {
          name: "dungeon_run",
        },
        {
          name: "dungeon_run_observation",
        },
        {
          name: "dungeon_unit",
        },
        {
          name: "encounter",
        },
        {
          name: "milestone",
        },
        {
          name: "milestone_requirement",
        },
        {
          name: "requirement",
        },
        {
          name: "unit",
        },
      ]);
    }).pipe(E.provide(makeDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("seeds catalog tables", async () => {
    const program = E.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

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
        FROM dungeon
        WHERE id = '11'
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
        FROM ability
        WHERE id = '634'
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
        FROM ability_unit
        WHERE ability_id = '634'
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
        FROM encounter
        WHERE dungeon_id = '24'
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
        FROM unit
        WHERE id = '276'
      `;

      const inactiveUnit = yield* sql<{
        readonly id: string;
        readonly status: string;
      }>`
        SELECT
          id,
          status
        FROM unit
        WHERE id = '282'
      `;

      const unitCount = yield* sql<{
        readonly count: number;
      }>`
        SELECT COUNT(*) AS count
        FROM unit
      `;

      const dungeonUnitCount = yield* sql<{
        readonly count: number;
      }>`
        SELECT COUNT(*) AS count
        FROM dungeon_unit
      `;

      const abilityUnitCount = yield* sql<{
        readonly count: number;
      }>`
        SELECT COUNT(*) AS count
        FROM ability_unit
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
    }).pipe(E.provide(makeDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("cascades configuration deletion to milestones and milestone requirements", async () => {
    const program = E.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql`
        INSERT INTO configuration_definition (
          id,
          dungeon_id,
          dungeon_level,
          fingerprint,
          canonical_json,
          created_at,
          updated_at
        )
        VALUES (
          'configuration-definition-1',
          '11',
          63,
          'definition-fingerprint-1',
          '{}',
          1000,
          1000
        )
      `;

      yield* sql`
        INSERT INTO configuration (
          id,
          configuration_definition_id,
          label,
          fingerprint,
          canonical_json,
          created_at,
          updated_at
        )
        VALUES (
          'configuration-1',
          'configuration-definition-1',
          'Test Configuration',
          'configuration-fingerprint-1',
          '{}',
          1000,
          1000
        )
      `;

      yield* sql`
        INSERT INTO requirement (
          id,
          configuration_definition_id,
          type,
          target_id,
          start_occurrence,
          required_count,
          created_at,
          updated_at
        )
        VALUES (
          'requirement-1',
          'configuration-definition-1',
          'UNIT_DEATH',
          '42',
          1,
          1,
          1000,
          1000
        )
      `;

      yield* sql`
        INSERT INTO milestone (
          id,
          configuration_id,
          label,
          created_at,
          updated_at
        )
        VALUES (
          'milestone-1',
          'configuration-1',
          'Desecrator 1 Killed',
          1000,
          1000
        )
      `;

      yield* sql`
        INSERT INTO milestone_requirement (
          milestone_id,
          requirement_id,
          created_at
        )
        VALUES (
          'milestone-1',
          'requirement-1',
          1000
        )
      `;

      yield* sql`
        DELETE FROM configuration
        WHERE id = 'configuration-1'
      `;

      const configurations = yield* sql`
        SELECT id
        FROM configuration
      `;

      const configurationDefinitions = yield* sql`
        SELECT id
        FROM configuration_definition
      `;

      const milestones = yield* sql`
        SELECT id
        FROM milestone
      `;

      const milestoneRequirements = yield* sql`
        SELECT milestone_id, requirement_id
        FROM milestone_requirement
      `;

      const requirements = yield* sql`
        SELECT id
        FROM requirement
      `;

      expect(configurations).toEqual([]);
      expect(milestones).toEqual([]);
      expect(milestoneRequirements).toEqual([]);

      expect(configurationDefinitions).toEqual([
        {
          id: "configuration-definition-1",
        },
      ]);

      expect(requirements).toEqual([
        {
          id: "requirement-1",
        },
      ]);
    }).pipe(E.provide(makeDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("creates the database parent directory on first startup", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const directory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "fellowship-run-tracker-",
        });

        const databaseFilename = path.join(
          directory,
          "nested",
          "data",
          "fellowship-run-tracker.db",
        );

        yield* E.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          const result = yield* sql`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
          `;

          expect(result.length).toBeGreaterThan(0);
        }).pipe(E.provide(makeDatabaseLayer(databaseFilename)));
      }),
    ).pipe(E.provide(NodePlatformLive));

    await runTest(program);
  });
});
