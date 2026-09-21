import * as Schema from "effect/Schema";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { FellowshipLogsRateLimitDataSchema } from "@/services/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

export const FellowshipLogsApiDungeonRunReferenceSchema = Schema.Struct({
  fightId: FellowshipLogsFightIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
});

export type FellowshipLogsApiDungeonRunReference =
  typeof FellowshipLogsApiDungeonRunReferenceSchema.Type;

export const FellowshipLogsApiImportDungeonRunOptionsSchema = Schema.Struct({
  fightId: FellowshipLogsFightIdSchema,
  isOwnRun: Schema.Boolean,
  reportCode: FellowshipLogsReportCodeSchema,
});

export type FellowshipLogsApiImportDungeonRunOptions =
  typeof FellowshipLogsApiImportDungeonRunOptionsSchema.Type;

export const FellowshipLogsApiDungeonRunMetadataSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  endedAtMilliseconds: NonNegativeIntegerSchema,
  startedAtMilliseconds: NonNegativeIntegerSchema,
});

export type FellowshipLogsApiDungeonRunMetadata =
  typeof FellowshipLogsApiDungeonRunMetadataSchema.Type;

export const FellowshipLogsApiImportDungeonRunResultSchema = Schema.Struct({
  dungeonRunId: DungeonRunIdSchema,
});

export type FellowshipLogsApiImportDungeonRunResult =
  typeof FellowshipLogsApiImportDungeonRunResultSchema.Type;

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
