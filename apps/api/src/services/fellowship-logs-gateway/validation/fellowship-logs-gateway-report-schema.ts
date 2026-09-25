import * as Schema from "effect/Schema";

import { withRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsGatewayReportActorSchema = Schema.Struct({
  gameID: Schema.Finite.pipe(Schema.NullOr),
  id: Schema.Int.pipe(Schema.NullOr),
  name: Schema.String.pipe(Schema.NullOr),
  petOwner: Schema.Int.pipe(Schema.NullOr),
  subType: Schema.String.pipe(Schema.NullOr),
  type: Schema.String.pipe(Schema.NullOr),
});

const FellowshipLogsGatewayReportMasterDataSchema = Schema.Struct({
  actors: FellowshipLogsGatewayReportActorSchema.pipe(
    Schema.Array,
    Schema.NullOr,
  ),
  gameVersion: Schema.Int.pipe(Schema.NullOr),
  logVersion: Schema.Int,
});

const FellowshipLogsGatewayReportEventsSchema = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
  nextPageTimestamp: Schema.Finite.pipe(Schema.NullOr),
});

const FellowshipLogsGatewayReportSchema = Schema.Struct({
  code: NonEmptyStringSchema,
  endTime: NonNegativeIntegerSchema,
  events: FellowshipLogsGatewayReportEventsSchema,
  masterData: FellowshipLogsGatewayReportMasterDataSchema,
  revision: NonNegativeIntegerSchema,
  startTime: NonNegativeIntegerSchema,
  title: Schema.String,
});

export type FellowshipLogsGatewayReport =
  typeof FellowshipLogsGatewayReportSchema.Type;

export const FellowshipLogsGatewayReportResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: FellowshipLogsGatewayReportSchema.pipe(Schema.NullOr),
  }),
});
