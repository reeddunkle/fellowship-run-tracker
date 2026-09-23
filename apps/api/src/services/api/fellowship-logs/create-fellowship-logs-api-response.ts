import * as DateTime from "effect/DateTime";

import { type FellowshipLogsDungeonRunMetadata } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { type FellowshipLogsImportedDungeonRunRow } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-imported-dungeon-run-row-schema.ts";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiImportedDungeonRun,
  type FellowshipLogsApiLastKnownRateLimitData,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";

export function createFellowshipLogsDungeonRunMetadataApiResponse(
  metadata: FellowshipLogsDungeonRunMetadata,
): FellowshipLogsApiDungeonRunMetadata {
  return {
    dungeonId: metadata.dungeonId,
    dungeonLevel: metadata.dungeonLevel,
    endedAtMilliseconds: DateTime.toEpochMillis(metadata.endedAt),
    startedAtMilliseconds: DateTime.toEpochMillis(metadata.startedAt),
  };
}

export function createFellowshipLogsRateLimitDataApiResponse(
  rateLimitData: FellowshipLogsRateLimitSnapshot | null,
): FellowshipLogsApiLastKnownRateLimitData {
  return rateLimitData;
}

export function createFellowshipLogsImportedDungeonRunApiResponse(
  row: FellowshipLogsImportedDungeonRunRow,
): FellowshipLogsApiImportedDungeonRun {
  return {
    dungeonId: row.dungeonId,
    dungeonLevel: row.dungeonLevel,
    dungeonName: row.dungeonName,
    dungeonRunId: row.dungeonRunId,
    endedAtMilliseconds:
      row.endedAt === null ? null : DateTime.toEpochMillis(row.endedAt),
    fightId: row.fightId,
    importedAtMilliseconds: DateTime.toEpochMillis(row.importedAt),
    reportCode: row.reportCode,
    startedAtMilliseconds:
      row.startedAt === null ? null : DateTime.toEpochMillis(row.startedAt),
  };
}
