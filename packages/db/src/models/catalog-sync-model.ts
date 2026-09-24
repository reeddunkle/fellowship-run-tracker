import * as Model from "effect/unstable/schema/Model";

import { CatalogNameSchema } from "@frt/db/validation/catalog-sync/catalog-sync-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export class CatalogSyncModel extends Model.Class<CatalogSyncModel>(
  "CatalogSyncModel",
)({
  catalog: CatalogNameSchema,
  checksum: NonEmptyStringSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
