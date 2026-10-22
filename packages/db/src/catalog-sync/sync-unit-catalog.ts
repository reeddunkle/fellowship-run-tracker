import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { loadEffectiveFellowshipCatalogs } from "@frt/db/catalogs/load-effective-fellowship-catalogs.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";

const CATALOG = "UNIT" as const;

export const syncUnitCatalog = E.fn("syncUnitCatalog")(function* () {
  const catalogSyncDAO = yield* CatalogSyncDAO;
  const sql = yield* MainDatabase;

  const catalogSync = yield* catalogSyncDAO.getByCatalog({
    catalog: CATALOG,
  });

  const checksum = CATALOG_CHECKSUMS.unit;

  if (Option.isSome(catalogSync) && catalogSync.value.checksum === checksum) {
    return;
  }

  const catalogs = yield* loadEffectiveFellowshipCatalogs;

  yield* sql.withTransaction(
    E.gen(function* () {
      const now = DateTime.toEpochMillis(yield* DateTime.now);

      for (const unit of catalogs.units) {
        yield* sql`
          INSERT INTO
            unit (
              id,
              group_key,
              name,
              status,
              variant,
              created_at,
              updated_at
            )
          VALUES
            (
              ${unit.id},
              ${unit.groupKey},
              ${unit.name},
              ${unit.status},
              ${unit.variant},
              ${now},
              ${now}
            )
          ON CONFLICT (id) DO UPDATE
          SET
            group_key = excluded.group_key,
            name = excluded.name,
            status = excluded.status,
            variant = excluded.variant,
            updated_at = excluded.updated_at
          WHERE
            unit.group_key IS NOT excluded.group_key
            OR unit.name IS NOT excluded.name
            OR unit.status IS NOT excluded.status
            OR unit.variant IS NOT excluded.variant
        `;
      }

      yield* sql`
        DELETE FROM dungeon_unit
        WHERE
          1 = 1
      `;

      for (const unit of catalogs.units) {
        for (const dungeonId of unit.dungeonIds) {
          yield* sql`
            INSERT INTO
              dungeon_unit (dungeon_id, unit_id, created_at, updated_at)
            VALUES
              (
                ${dungeonId},
                ${unit.id},
                ${now},
                ${now}
              )
          `;
        }
      }

      yield* sql`
        UPDATE unit
        SET
          status = 'INACTIVE',
          updated_at = ${now}
        WHERE
          id NOT IN ${sql.in(
            catalogs.units.map((unit) => {
              return unit.id;
            }),
          )}
          AND status IS NOT 'INACTIVE'
      `;

      yield* catalogSyncDAO.setChecksum({
        catalog: CATALOG,
        checksum,
      });
    }),
  );
});
