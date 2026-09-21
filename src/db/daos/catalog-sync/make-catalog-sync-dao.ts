import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { CatalogSyncModel } from "@/db/models/catalog-sync-model.ts";

import { type CatalogSyncDAOShape } from "./catalog-sync-dao.ts";

function decodeCatalogSyncRows(
  rows: unknown,
): E.Effect<ReadonlyArray<CatalogSyncModel>, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Schema.Array(CatalogSyncModel))(rows);
}

export const makeCatalogSyncDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getByCatalog: CatalogSyncDAOShape["getByCatalog"] = ({ catalog }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          catalog,
          checksum,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM
          catalog_sync
        WHERE
          catalog = ${catalog}
        LIMIT
          1
      `;

      const catalogSyncs = yield* decodeCatalogSyncRows(rows);
      const catalogSync = catalogSyncs[0];

      return catalogSync === undefined
        ? Option.none<CatalogSyncModel>()
        : Option.some(catalogSync);
    });
  };

  const setChecksum: CatalogSyncDAOShape["setChecksum"] = ({
    catalog,
    checksum,
  }) => {
    return E.gen(function* () {
      const now = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        INSERT INTO
          catalog_sync (catalog, checksum, created_at, updated_at)
        VALUES
          (
            ${catalog},
            ${checksum},
            ${now},
            ${now}
          )
        ON CONFLICT (catalog) DO UPDATE
        SET
          checksum = excluded.checksum,
          updated_at = excluded.updated_at
      `;
    });
  };

  return {
    getByCatalog,
    setChecksum,
  } satisfies CatalogSyncDAOShape;
});
