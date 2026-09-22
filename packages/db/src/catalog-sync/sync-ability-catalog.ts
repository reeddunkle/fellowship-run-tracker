import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { FELLOWSHIP_ABILITY } from "@frt/db/catalogs/ability/fellowship-ability-catalog.ts";
import { CATALOG_CHECKSUMS } from "@frt/db/catalogs/generated/catalog-checksums.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";

const CATALOG = "ABILITY" as const;

export const syncAbilityCatalog = E.fn("sync-ability-catalog")(function* () {
  const catalogSyncDAO = yield* CatalogSyncDAO;
  const sql = yield* SqlClient.SqlClient;

  const catalogSync = yield* catalogSyncDAO.getByCatalog({
    catalog: CATALOG,
  });

  const checksum = CATALOG_CHECKSUMS.ability;

  if (Option.isSome(catalogSync) && catalogSync.value.checksum === checksum) {
    return;
  }

  yield* sql.withTransaction(
    E.gen(function* () {
      const now = DateTime.toEpochMillis(yield* DateTime.now);

      for (const ability of Object.values(FELLOWSHIP_ABILITY)) {
        yield* sql`
          INSERT INTO
            ability (id, name, created_at, updated_at)
          VALUES
            (
              ${ability.id},
              ${ability.name},
              ${now},
              ${now}
            )
          ON CONFLICT (id) DO UPDATE
          SET
            name = excluded.name,
            updated_at = excluded.updated_at
          WHERE
            ability.name IS NOT excluded.name
        `;

        yield* sql`
          INSERT INTO
            ability_unit (ability_id, unit_id, created_at, updated_at)
          VALUES
            (
              ${ability.id},
              ${ability.unitId},
              ${now},
              ${now}
            )
          ON CONFLICT (ability_id) DO UPDATE
          SET
            unit_id = excluded.unit_id,
            updated_at = excluded.updated_at
          WHERE
            ability_unit.unit_id IS NOT excluded.unit_id
        `;
      }

      yield* catalogSyncDAO.setChecksum({
        catalog: CATALOG,
        checksum,
      });
    }),
  );
});
