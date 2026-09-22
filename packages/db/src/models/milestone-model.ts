import * as Model from "effect/unstable/schema/Model";

import { MilestoneIdSchema } from "@frt/db/validation/milestone/milestone-id-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/validation/common-schemas.ts";
import { ConfigurationIdSchema } from "@frt/shared/validation/configuration/configuration-id-schema.ts";
import { MilestoneComparisonTimeSchema } from "@frt/shared/validation/milestone/milestone-comparison-time-schema.ts";

export class MilestoneModel extends Model.Class<MilestoneModel>(
  "MilestoneModel",
)({
  comparisonTime: MilestoneComparisonTimeSchema,
  configurationId: ConfigurationIdSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  id: Model.UuidV7Insert(MilestoneIdSchema),
  label: NonEmptyStringSchema,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
