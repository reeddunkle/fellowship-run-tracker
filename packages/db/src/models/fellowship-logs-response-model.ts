import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { FellowshipLogsResponseOperationSchema } from "@frt/db/validation/fellowship-logs-response/fellowship-logs-response-operation-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

export class FellowshipLogsResponseModel extends Model.Class<FellowshipLogsResponseModel>(
  "FellowshipLogsResponseModel",
)({
  body: Schema.Uint8Array,
  byteSize: NonNegativeIntegerSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  fightId: Schema.NullOr(FellowshipLogsFightIdSchema),
  lastAccessedAt: Schema.DateTimeUtcFromMillis,
  operation: FellowshipLogsResponseOperationSchema,
  reportCode: FellowshipLogsReportCodeSchema,
  reportRevision: Schema.NullOr(NonNegativeIntegerSchema),
  requestKey: Schema.String,
}) {}
