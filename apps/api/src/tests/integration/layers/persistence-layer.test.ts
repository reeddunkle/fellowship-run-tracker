import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { loadEffectiveFellowshipCatalogs } from "@frt/db/catalogs/load-effective-fellowship-catalogs.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { makeTestDatabaseOptions } from "@frt/db/tests/common/make-test-database-options.ts";

describe("PersistenceLayer", () => {
  test("syncs every catalog table from its source catalog", async () => {
    const program = E.gen(function* () {
      const sql = yield* MainDatabase;
      const catalogs = yield* loadEffectiveFellowshipCatalogs;

      const [counts] = yield* sql<{
        readonly abilityCount: number;
        readonly abilityUnitCount: number;
        readonly dungeonCount: number;
        readonly dungeonUnitCount: number;
        readonly encounterCount: number;
        readonly inactiveUnitCount: number;
        readonly unitCount: number;
      }>`
        SELECT
          (
            SELECT
              COUNT(*)
            FROM
              ability
          ) AS ability_count,
          (
            SELECT
              COUNT(*)
            FROM
              ability_unit
          ) AS ability_unit_count,
          (
            SELECT
              COUNT(*)
            FROM
              dungeon
          ) AS dungeon_count,
          (
            SELECT
              COUNT(*)
            FROM
              dungeon_unit
          ) AS dungeon_unit_count,
          (
            SELECT
              COUNT(*)
            FROM
              encounter
          ) AS encounter_count,
          (
            SELECT
              COUNT(*)
            FROM
              unit
            WHERE
              status = 'INACTIVE'
          ) AS inactive_unit_count,
          (
            SELECT
              COUNT(*)
            FROM
              unit
          ) AS unit_count
      `;

      const catalogSyncs = yield* sql<{
        readonly catalog: string;
        readonly checksum: string;
      }>`
        SELECT
          catalog,
          checksum
        FROM
          catalog_sync
        ORDER BY
          catalog
      `;

      const dungeonUnitCount = catalogs.units.reduce((total, unit) => {
        return total + unit.dungeonIds.length;
      }, 0);

      const inactiveUnitCount = catalogs.units.filter((unit) => {
        return unit.status === "INACTIVE";
      }).length;

      const expectedCatalogSyncs = Object.entries(CATALOG_CHECKSUMS)
        .map(([catalog, checksum]) => {
          return {
            catalog: catalog.toUpperCase(),
            checksum,
          };
        })
        .toSorted((left, right) => {
          return left.catalog.localeCompare(right.catalog);
        });

      expect(counts).toEqual({
        abilityCount: catalogs.abilities.length,
        abilityUnitCount: catalogs.abilities.length,
        dungeonCount: catalogs.dungeons.length,
        dungeonUnitCount,
        encounterCount: catalogs.encounters.length,
        inactiveUnitCount,
        unitCount: catalogs.units.length,
      });

      expect(catalogSyncs).toEqual(expectedCatalogSyncs);
    }).pipe(E.provide(makePersistenceLayer(makeTestDatabaseOptions())));

    await runTest(program);
  });
});
