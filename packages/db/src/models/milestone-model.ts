import * as Model from "effect/unstable/schema/Model";

import { MilestoneIdSchema } from "@frt/db/validation/milestone/milestone-id-schema.ts";
import { ConfigurationIdSchema } from "@frt/shared/configuration/configuration-id-schema.ts";
import { MilestoneComparisonTimeSchema } from "@frt/shared/milestone/milestone-comparison-time-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

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
