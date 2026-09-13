import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type CatalogSyncModel } from "@/db/models/catalog-sync-model.ts";
import { type CatalogName } from "@/validation/catalog-sync/catalog-sync-schema.ts";
import { type NonEmptyString } from "@/validation/common-schemas.ts";

type GetCatalogSyncByCatalogOptions = {
  readonly catalog: CatalogName;
};

type SetCatalogChecksumOptions = {
  readonly catalog: CatalogName;
  readonly checksum: NonEmptyString;
};

export type CatalogSyncDAOError = SqlError.SqlError | Schema.SchemaError;

export type CatalogSyncDAOShape = {
  readonly getByCatalog: (
    options: GetCatalogSyncByCatalogOptions,
  ) => E.Effect<Option.Option<CatalogSyncModel>, CatalogSyncDAOError>;

  readonly setChecksum: (
    options: SetCatalogChecksumOptions,
  ) => E.Effect<void, CatalogSyncDAOError>;
};

export class CatalogSyncDAO extends Context.Service<
  CatalogSyncDAO,
  CatalogSyncDAOShape
>()(
  "fellowship-run-tracker/db/daos/catalog-sync/catalog-sync-dao/CatalogSyncDAO",
) {}
