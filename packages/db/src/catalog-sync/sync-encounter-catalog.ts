import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { FELLOWSHIP_ENCOUNTER } from "@frt/db/catalogs/encounter/fellowship-encounter-catalog.ts";
import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";

const CATALOG = "ENCOUNTER" as const;

export const syncEncounterCatalog = E.fn("sync-encounter-catalog")(
  function* () {
    const catalogSyncDAO = yield* CatalogSyncDAO;
    const sql = yield* MainDatabase;

    const catalogSync = yield* catalogSyncDAO.getByCatalog({
      catalog: CATALOG,
    });

    const checksum = CATALOG_CHECKSUMS.encounter;

    if (Option.isSome(catalogSync) && catalogSync.value.checksum === checksum) {
      return;
    }

    yield* sql.withTransaction(
      E.gen(function* () {
        const now = DateTime.toEpochMillis(yield* DateTime.now);

        for (const encounter of Object.values(FELLOWSHIP_ENCOUNTER)) {
          yield* sql`
            INSERT INTO
              encounter (dungeon_id, id, name, created_at, updated_at)
            VALUES
              (
                ${encounter.dungeonId},
                ${encounter.encounterId},
                ${encounter.name},
                ${now},
                ${now}
              )
            ON CONFLICT (dungeon_id, id) DO UPDATE
            SET
              name = excluded.name,
              updated_at = excluded.updated_at
            WHERE
              encounter.name IS NOT excluded.name
          `;
        }

        yield* catalogSyncDAO.setChecksum({
          catalog: CATALOG,
          checksum,
        });
      }),
    );
  },
);
