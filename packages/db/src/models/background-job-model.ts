import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { BackgroundJobFailureSchema } from "@frt/shared/background-job/background-job-failure-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { BackgroundJobStatusSchema } from "@frt/shared/background-job/background-job-status-schema.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

export class BackgroundJobModel extends Model.Class<BackgroundJobModel>(
  "BackgroundJobModel",
)({
  attempts: NonNegativeIntegerSchema,
  availableAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  createdAt: Model.DateTimeInsertFromNumber,
  error: BackgroundJobFailureSchema.pipe(Schema.fromJsonString, Schema.NullOr),
  finishedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  id: Model.UuidV7Insert(BackgroundJobIdSchema),
  idempotencyKey: Schema.NullOr(NonEmptyStringSchema),
  kind: NonEmptyStringSchema,
  payload: Model.JsonFromString(Schema.Json),
  queue: NonEmptyStringSchema,
  result: Schema.Json.pipe(Schema.fromJsonString, Schema.NullOr),
  startedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  status: BackgroundJobStatusSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
