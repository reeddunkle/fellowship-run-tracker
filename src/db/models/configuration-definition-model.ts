import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { PositiveIntegerSchema } from "@/validation/common-schemas.ts";
import { ConfigurationDefinitionFingerprintSchema } from "@/validation/configuration/configuration-definition-fingerprint-schema.ts";
import { ConfigurationDefinitionIdSchema } from "@/validation/configuration/configuration-definition-id-schema.ts";

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
