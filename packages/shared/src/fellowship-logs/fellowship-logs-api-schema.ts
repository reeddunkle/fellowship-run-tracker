import * as Schema from "effect/Schema";

import {
  ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema,
  ImportFellowshipLogsDungeonRunJobPayloadSchema,
} from "@frt/shared/background-job/background-job-api-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { FellowshipLogsRateLimitDataSchema } from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

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
  startedAtMilliseconds: NonNegativeIntegerSchema,
});

export type FellowshipLogsApiDungeonRunMetadata =
  typeof FellowshipLogsApiDungeonRunMetadataSchema.Type;

const FellowshipLogsApiRateLimitDataSchema = FellowshipLogsRateLimitDataSchema;

export type FellowshipLogsApiRateLimitData =
  typeof FellowshipLogsApiRateLimitDataSchema.Type;

export const FellowshipLogsApiLastKnownRateLimitDataSchema = Schema.NullOr(
  FellowshipLogsApiRateLimitDataSchema,
);

export type FellowshipLogsApiLastKnownRateLimitData =
  typeof FellowshipLogsApiLastKnownRateLimitDataSchema.Type;

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
