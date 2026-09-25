import * as Schema from "effect/Schema";

import {
  ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema,
  ImportFellowshipLogsDungeonRunJobPayloadSchema,
} from "@frt/shared/background-job/background-job-api-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsRateLimitSnapshotSchema } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  NonNegativeIntegerSchema,
  NonNegativeNumberSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

export const FellowshipLogsApiDungeonRunReferenceSchema = Schema.Struct({
  fightId: FellowshipLogsFightIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
});

export type FellowshipLogsApiDungeonRunReference =
  typeof FellowshipLogsApiDungeonRunReferenceSchema.Type;

export const FellowshipLogsApiQueueDungeonRunImportOptionsSchema =
  ImportFellowshipLogsDungeonRunJobPayloadSchema;

export type FellowshipLogsApiQueueDungeonRunImportOptions =
  typeof FellowshipLogsApiQueueDungeonRunImportOptionsSchema.Type;

export const FellowshipLogsApiQueueDungeonRunImportResultSchema = Schema.Struct(
  {
    job: ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema,
    wasAlreadyQueued: Schema.Boolean,
  },
);

export type FellowshipLogsApiQueueDungeonRunImportResult =
  typeof FellowshipLogsApiQueueDungeonRunImportResultSchema.Type;

export const FellowshipLogsApiDungeonRunMetadataSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  endedAtMilliseconds: NonNegativeIntegerSchema,
  isInProgress: Schema.Boolean,
  startedAtMilliseconds: NonNegativeIntegerSchema,
});

export type FellowshipLogsApiDungeonRunMetadata =
  typeof FellowshipLogsApiDungeonRunMetadataSchema.Type;

const FellowshipLogsApiRateLimitDataSchema =
  FellowshipLogsRateLimitSnapshotSchema;

export type FellowshipLogsApiRateLimitData =
  typeof FellowshipLogsApiRateLimitDataSchema.Type;

export const FellowshipLogsApiLastKnownRateLimitDataSchema = Schema.NullOr(
  FellowshipLogsApiRateLimitDataSchema,
);

export type FellowshipLogsApiLastKnownRateLimitData =
  typeof FellowshipLogsApiLastKnownRateLimitDataSchema.Type;

export const FellowshipLogsApiAnalyticsSummarySchema = Schema.Struct({
  apiRequestCount: NonNegativeIntegerSchema,
  cacheHitCount: NonNegativeIntegerSchema,
  cacheHitRate: NonNegativeNumberSchema,
  estimatedPointsSaved: NonNegativeIntegerSchema,
  pointsSpent: NonNegativeIntegerSchema,
  trackingSinceMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
});

export type FellowshipLogsApiAnalyticsSummary =
  typeof FellowshipLogsApiAnalyticsSummarySchema.Type;

const FellowshipLogsApiImportedDungeonRunSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  dungeonName: Schema.String,
  dungeonRunId: DungeonRunIdSchema,
  endedAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
  fightId: FellowshipLogsFightIdSchema,
  importedAtMilliseconds: NonNegativeIntegerSchema,
  reportCode: FellowshipLogsReportCodeSchema,
  startedAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
});

export type FellowshipLogsApiImportedDungeonRun =
  typeof FellowshipLogsApiImportedDungeonRunSchema.Type;

export const FellowshipLogsApiImportedDungeonRunListSchema = Schema.Array(
  FellowshipLogsApiImportedDungeonRunSchema,
);

export type FellowshipLogsApiImportedDungeonRunList =
  typeof FellowshipLogsApiImportedDungeonRunListSchema.Type;
