import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { loadEffectiveFellowshipCatalogs } from "@frt/db/catalogs/load-effective-fellowship-catalogs.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";

const CATALOG = "DUNGEON" as const;

export const syncDungeonCatalog = E.fn("syncDungeonCatalog")(function* () {
  const catalogSyncDAO = yield* CatalogSyncDAO;
  const sql = yield* MainDatabase;

  const catalogSync = yield* catalogSyncDAO.getByCatalog({
    catalog: CATALOG,
  });

  const checksum = CATALOG_CHECKSUMS.dungeon;

  if (Option.isSome(catalogSync) && catalogSync.value.checksum === checksum) {
    return;
  }

  const catalogs = yield* loadEffectiveFellowshipCatalogs;

  yield* sql.withTransaction(
    E.gen(function* () {
      const now = DateTime.toEpochMillis(yield* DateTime.now);

      for (const dungeon of catalogs.dungeons) {
        yield* sql`
          INSERT INTO
            dungeon (id, map_id, name, status, created_at, updated_at)
          VALUES
            (
              ${dungeon.dungeonId},
              ${dungeon.mapId},
              ${dungeon.name},
              'ACTIVE',
              ${now},
              ${now}
            )
          ON CONFLICT (id) DO UPDATE
          SET
            map_id = excluded.map_id,
            name = excluded.name,
            status = excluded.status,
            updated_at = excluded.updated_at
          WHERE
            dungeon.map_id IS NOT excluded.map_id
            OR dungeon.name IS NOT excluded.name
            OR dungeon.status IS NOT excluded.status
        `;
      }

      yield* sql`
        UPDATE dungeon
        SET
          status = 'INACTIVE',
          updated_at = ${now}
        WHERE
          id NOT IN ${sql.in(
            catalogs.dungeons.map((dungeon) => {
              return dungeon.dungeonId;
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
