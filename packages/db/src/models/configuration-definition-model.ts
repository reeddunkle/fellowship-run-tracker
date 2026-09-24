import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { ConfigurationDefinitionFingerprintSchema } from "@frt/db/validation/configuration/configuration-definition-fingerprint-schema.ts";
import { ConfigurationDefinitionIdSchema } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { PositiveIntegerSchema } from "@frt/shared/util/common-schemas.ts";

export class ConfigurationDefinitionModel extends Model.Class<ConfigurationDefinitionModel>(
  "ConfigurationDefinitionModel",
)({
  canonicalJson: Schema.String,
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  fingerprint: ConfigurationDefinitionFingerprintSchema,
  id: Model.UuidV7Insert(ConfigurationDefinitionIdSchema),
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
