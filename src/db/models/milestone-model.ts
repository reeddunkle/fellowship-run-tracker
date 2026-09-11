import * as Model from "effect/unstable/schema/Model";

import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";
import { ConfigurationIdSchema } from "@/validation/configuration/configuration-id-schema.ts";
import { MilestoneComparisonTimeSchema } from "@/validation/milestone/milestone-comparison-time-schema.ts";
import { MilestoneIdSchema } from "@/validation/milestone/milestone-id-schema.ts";

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
