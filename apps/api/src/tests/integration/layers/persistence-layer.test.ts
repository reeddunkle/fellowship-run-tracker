import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FELLOWSHIP_ABILITY } from "@frt/db/catalogs/ability/fellowship-ability-catalog.ts";
import { FELLOWSHIP_DUNGEON } from "@frt/db/catalogs/dungeon/fellowship-dungeon-catalog.ts";
import { FELLOWSHIP_ENCOUNTER } from "@frt/db/catalogs/encounter/fellowship-encounter-catalog.ts";
import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { loadFellowshipUnitCatalog } from "@frt/db/catalogs/unit/load-fellowship-unit-catalog.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { makeTestDatabaseOptions } from "@frt/db/tests/common/make-test-database-options.ts";

describe("PersistenceLayer", () => {
  test("syncs every catalog table from its source catalog", async () => {
    const program = E.gen(function* () {
      const sql = yield* MainDatabase;
      const unitCatalog = yield* loadFellowshipUnitCatalog();

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

      const abilities = Object.values(FELLOWSHIP_ABILITY);

      const dungeonUnitCount = unitCatalog.reduce((total, unit) => {
        return total + unit.dungeonIds.length;
      }, 0);

      const inactiveUnitCount = unitCatalog.filter((unit) => {
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
        abilityCount: abilities.length,
        abilityUnitCount: abilities.length,
        dungeonCount: Object.keys(FELLOWSHIP_DUNGEON).length,
        dungeonUnitCount,
        encounterCount: Object.keys(FELLOWSHIP_ENCOUNTER).length,
        inactiveUnitCount,
        unitCount: unitCatalog.length,
      });

      expect(catalogSyncs).toEqual(expectedCatalogSyncs);
    }).pipe(E.provide(makePersistenceLayer(makeTestDatabaseOptions())));

    await runTest(program);
  });
});
