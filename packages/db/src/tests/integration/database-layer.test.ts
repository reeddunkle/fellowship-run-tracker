import * as NodeServices from "@effect/platform-node/NodeServices";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { describe, expect, test } from "vitest";

import { makeDatabaseLayer } from "@frt/db/database-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

describe("DatabaseLayer", () => {
  test("runs database migrations", async () => {
    const program = E.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const tables = yield* sql<{ readonly name: string }>`
        SELECT
          name
        FROM
          sqlite_master
        WHERE
          type = 'table'
          AND name IN (
            'ability',
            'ability_unit',
            'app_settings',
            'catalog_sync',
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
        ORDER BY
          name
      `;

      expect(tables).toEqual([
        { name: "ability" },
        { name: "ability_unit" },
        { name: "app_settings" },
        { name: "catalog_sync" },
        { name: "configuration" },
        { name: "configuration_definition" },
        { name: "dungeon" },
        { name: "dungeon_run" },
        { name: "dungeon_run_observation" },
        { name: "dungeon_unit" },
        { name: "encounter" },
        { name: "milestone" },
        { name: "milestone_requirement" },
        { name: "requirement" },
        { name: "unit" },
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
            SELECT
              name
            FROM
              sqlite_master
            WHERE
              type = 'table'
          `;

          expect(result.length).toBeGreaterThan(0);
        }).pipe(E.provide(makeDatabaseLayer(databaseFilename)));
      }),
    ).pipe(E.provide(NodeServices.layer));

    await runTest(program);
  });
});
