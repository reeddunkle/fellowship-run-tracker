import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { loadEffectiveFellowshipCatalogs } from "@frt/db/catalogs/load-effective-fellowship-catalogs.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";

const CATALOG = "ENCOUNTER" as const;

export const syncEncounterCatalog = E.fn("syncEncounterCatalog")(function* () {
  const catalogSyncDAO = yield* CatalogSyncDAO;
  const sql = yield* MainDatabase;

  const catalogSync = yield* catalogSyncDAO.getByCatalog({
    catalog: CATALOG,
  });

  const checksum = CATALOG_CHECKSUMS.encounter;

  if (Option.isSome(catalogSync) && catalogSync.value.checksum === checksum) {
    return;
  }

  const catalogs = yield* loadEffectiveFellowshipCatalogs;

  yield* sql.withTransaction(
    E.gen(function* () {
      const now = DateTime.toEpochMillis(yield* DateTime.now);

      for (const encounter of catalogs.encounters) {
        yield* sql`
          INSERT INTO
            encounter (
              dungeon_id,
              id,
              name,
              status,
              created_at,
              updated_at
            )
          VALUES
            (
              ${encounter.dungeonId},
              ${encounter.encounterId},
              ${encounter.name},
              'ACTIVE',
              ${now},
              ${now}
            )
          ON CONFLICT (dungeon_id, id) DO UPDATE
          SET
            name = excluded.name,
            status = excluded.status,
            updated_at = excluded.updated_at
          WHERE
            encounter.name IS NOT excluded.name
            OR encounter.status IS NOT excluded.status
        `;
      }

      const encounterKeys = catalogs.encounters.map((encounter) => {
        return `${encounter.dungeonId}:${encounter.encounterId}`;
      });

      yield* sql`
        UPDATE encounter
        SET
          status = 'INACTIVE',
          updated_at = ${now}
        WHERE
          dungeon_id || ':' || id NOT IN ${sql.in(encounterKeys)}
          AND status IS NOT 'INACTIVE'
      `;

      yield* catalogSyncDAO.setChecksum({
        catalog: CATALOG,
        checksum,
      });
    }),
  );
});
