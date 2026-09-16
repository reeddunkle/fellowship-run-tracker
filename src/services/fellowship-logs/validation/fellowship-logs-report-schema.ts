import * as Schema from "effect/Schema";

import { withRateLimitData } from "@/services/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
} from "@/validation/common-schemas.ts";

const FellowshipLogsReportActorSchema = Schema.Struct({
  gameID: Schema.Finite.pipe(Schema.NullOr),
  id: Schema.Int.pipe(Schema.NullOr),
  name: Schema.String.pipe(Schema.NullOr),
  petOwner: Schema.Int.pipe(Schema.NullOr),
  subType: Schema.String.pipe(Schema.NullOr),
  type: Schema.String.pipe(Schema.NullOr),
});

const FellowshipLogsReportMasterDataSchema = Schema.Struct({
  actors: FellowshipLogsReportActorSchema.pipe(Schema.Array, Schema.NullOr),
  gameVersion: Schema.Int.pipe(Schema.NullOr),
  logVersion: Schema.Int,
});

const FellowshipLogsReportEventsSchema = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
  nextPageTimestamp: Schema.Finite.pipe(Schema.NullOr),
});

const FellowshipLogsReportSchema = Schema.Struct({
  code: NonEmptyStringSchema,
  endTime: NonNegativeIntegerSchema,
  events: FellowshipLogsReportEventsSchema,
  masterData: FellowshipLogsReportMasterDataSchema,
  revision: NonNegativeIntegerSchema,
  startTime: NonNegativeIntegerSchema,
  title: Schema.String,
});

export type FellowshipLogsReport = typeof FellowshipLogsReportSchema.Type;

export const FellowshipLogsReportResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: FellowshipLogsReportSchema.pipe(Schema.NullOr),
  }),
});
