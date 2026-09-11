import * as Model from "effect/unstable/schema/Model";

import { MilestoneIdSchema } from "@/validation/milestone/milestone-id-schema.ts";
import { RequirementIdSchema } from "@/validation/requirement/requirement-id-schema.ts";

export class MilestoneRequirementModel extends Model.Class<MilestoneRequirementModel>(
  "MilestoneRequirementModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  milestoneId: MilestoneIdSchema,
  requirementId: RequirementIdSchema,
}) {}
