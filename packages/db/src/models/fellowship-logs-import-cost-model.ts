import * as Schema from "effect/Schema";
import * as Model from "effect/schema/Model";

import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { FellowshipLogsConnectionProfileSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsImportOutcomeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-import-cost-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  BooleanIntSchema,
  NonNegativeIntegerSchema,
  NonNegativeNumberSchema,
} from "@frt/shared/util/common-schemas.ts";

export class FellowshipLogsImportCostModel extends Model.Class<FellowshipLogsImportCostModel>(
  "FellowshipLogsImportCostModel",
)({
  apiRequestCount: NonNegativeIntegerSchema,
  applicationPoints: NonNegativeNumberSchema,
  cacheHitCount: NonNegativeIntegerSchema,
  completedAt: Schema.DateTimeUtcFromMillis,
  fightId: FellowshipLogsFightIdSchema,
  followsProfileChange: BooleanIntSchema,
  id: NonNegativeIntegerSchema,
  includesLookup: BooleanIntSchema,
  isResumed: BooleanIntSchema,
  jobId: BackgroundJobIdSchema,
  outcome: FellowshipLogsImportOutcomeSchema,
  pointPolicyVersion: Schema.String,
  profile: Schema.NullOr(FellowshipLogsConnectionProfileSchema),
  reportCode: FellowshipLogsReportCodeSchema,
  startedAt: Schema.DateTimeUtcFromMillis,
  totalPoints: NonNegativeNumberSchema,
  unmeasuredRequestCount: NonNegativeIntegerSchema,
  userPoints: NonNegativeNumberSchema,
}) {}
