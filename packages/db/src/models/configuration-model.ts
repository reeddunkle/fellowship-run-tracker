import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { ConfigurationDefinitionIdSchema } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { ConfigurationFingerprintSchema } from "@frt/shared/configuration/configuration-fingerprint-schema.ts";
import { ConfigurationIdSchema } from "@frt/shared/configuration/configuration-id-schema.ts";
import { ConfigurationLabelSchema } from "@frt/shared/configuration/configuration-label-schema.ts";

export class ConfigurationModel extends Model.Class<ConfigurationModel>(
  "ConfigurationModel",
)({
  canonicalJson: Schema.String,
  configurationDefinitionId: ConfigurationDefinitionIdSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  fingerprint: ConfigurationFingerprintSchema,
  id: Model.UuidV7Insert(ConfigurationIdSchema),
  label: ConfigurationLabelSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
