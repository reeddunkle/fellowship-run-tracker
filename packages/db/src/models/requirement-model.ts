import * as Model from "effect/unstable/schema/Model";

import { ConfigurationDefinitionIdSchema } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { RequirementIdSchema } from "@frt/db/validation/requirement/requirement-id-schema.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";

export class RequirementModel extends Model.Class<RequirementModel>(
  "RequirementModel",
)({
  configurationDefinitionId: ConfigurationDefinitionIdSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  id: Model.UuidV7Insert(RequirementIdSchema),
  requiredCount: PositiveIntegerSchema,
  startOccurrence: PositiveIntegerSchema,
  targetId: NonEmptyStringSchema,
  type: RequirementEventTypeSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
