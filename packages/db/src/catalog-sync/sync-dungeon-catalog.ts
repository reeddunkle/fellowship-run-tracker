import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { FELLOWSHIP_DUNGEON } from "@frt/db/catalogs/dungeon/fellowship-dungeon-catalog.ts";
import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";

const CATALOG = "DUNGEON" as const;

export const syncDungeonCatalog = E.fn("sync-dungeon-catalog")(function* () {
  const catalogSyncDAO = yield* CatalogSyncDAO;
  const sql = yield* MainDatabase;

  const catalogSync = yield* catalogSyncDAO.getByCatalog({
    catalog: CATALOG,
  });

  const checksum = CATALOG_CHECKSUMS.dungeon;

  if (Option.isSome(catalogSync) && catalogSync.value.checksum === checksum) {
    return;
  }

  yield* sql.withTransaction(
    E.gen(function* () {
      const now = DateTime.toEpochMillis(yield* DateTime.now);

      for (const dungeon of Object.values(FELLOWSHIP_DUNGEON)) {
        yield* sql`
          INSERT INTO
            dungeon (id, map_id, name, created_at, updated_at)
          VALUES
            (
              ${dungeon.dungeonId},
              ${dungeon.mapId},
              ${dungeon.name},
              ${now},
              ${now}
            )
          ON CONFLICT (id) DO UPDATE
          SET
            map_id = excluded.map_id,
            name = excluded.name,
            updated_at = excluded.updated_at
          WHERE
            dungeon.map_id IS NOT excluded.map_id
            OR dungeon.name IS NOT excluded.name
        `;
      }

      yield* catalogSyncDAO.setChecksum({
        catalog: CATALOG,
        checksum,
      });
    }),
  );
});
