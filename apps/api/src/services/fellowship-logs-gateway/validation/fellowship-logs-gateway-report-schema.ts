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

export const FellowshipLogsGatewayReportEventsSchema = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
  nextPageTimestamp: Schema.Finite.pipe(Schema.NullOr),
});

const FellowshipLogsGatewayReportFields = {
  code: NonEmptyStringSchema,
  endTime: NonNegativeIntegerSchema,
  masterData: FellowshipLogsGatewayReportMasterDataSchema,
  revision: NonNegativeIntegerSchema,
  startTime: NonNegativeIntegerSchema,
  title: Schema.String,
};

const FellowshipLogsGatewayReportSchema = Schema.Struct({
  ...FellowshipLogsGatewayReportFields,
  events: FellowshipLogsGatewayReportEventsSchema,
});

const FellowshipLogsGatewayFilteredReportSchema = Schema.Struct({
  ...FellowshipLogsGatewayReportFields,
  casts: FellowshipLogsGatewayReportEventsSchema,
  deaths: FellowshipLogsGatewayReportEventsSchema,
  dungeonEnds: FellowshipLogsGatewayReportEventsSchema,
  dungeonStarts: FellowshipLogsGatewayReportEventsSchema,
  encounterEnds: FellowshipLogsGatewayReportEventsSchema,
  encounterStarts: FellowshipLogsGatewayReportEventsSchema,
});

export type FellowshipLogsGatewayReport =
  typeof FellowshipLogsGatewayReportSchema.Type;

export type FellowshipLogsGatewayFilteredReport =
  typeof FellowshipLogsGatewayFilteredReportSchema.Type;

export const FellowshipLogsGatewayReportResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: Schema.Union([
      FellowshipLogsGatewayReportSchema,
      FellowshipLogsGatewayFilteredReportSchema,
    ]).pipe(Schema.NullOr),
  }),
});
