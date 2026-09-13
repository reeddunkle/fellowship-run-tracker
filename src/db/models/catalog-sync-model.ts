import * as Model from "effect/unstable/schema/Model";

import { CatalogNameSchema } from "@/validation/catalog-sync/catalog-sync-schema.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export class CatalogSyncModel extends Model.Class<CatalogSyncModel>(
  "CatalogSyncModel",
)({
  catalog: CatalogNameSchema,
  checksum: NonEmptyStringSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
