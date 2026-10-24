import * as DateTime from "effect/DateTime";

import { type FellowshipLogsGatewayDungeonRunMetadata } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { type FellowshipLogsImportedDungeonRunRow } from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiImportedDungeonRun,
  type FellowshipLogsApiLastKnownRateLimitData,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { type FellowshipLogsApiPointPools } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import { type FellowshipLogsLookupWorkflowId } from "@frt/shared/fellowship-logs/fellowship-logs-lookup-workflow-id-schema.ts";
import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import {
  type FellowshipLogsPointPools,
  getFellowshipLogsPointPools,
} from "@frt/shared/fellowship-logs/get-fellowship-logs-point-pools.ts";

export function createFellowshipLogsDungeonRunMetadataApiResponse(
  metadata: FellowshipLogsGatewayDungeonRunMetadata,
  lookupWorkflowId: FellowshipLogsLookupWorkflowId,
): FellowshipLogsApiDungeonRunMetadata {
  return {
    dungeonId: metadata.dungeonId,
    dungeonLevel: metadata.dungeonLevel,
    endedAtMilliseconds: DateTime.toEpochMillis(metadata.endedAt),
    isInProgress: metadata.isInProgress,
    lookupWorkflowId,
    startedAtMilliseconds: DateTime.toEpochMillis(metadata.startedAt),
  };
}

export function createFellowshipLogsRateLimitDataApiResponse(
  rateLimitData: FellowshipLogsRateLimitSnapshot | null,
): FellowshipLogsApiLastKnownRateLimitData {
  return rateLimitData === null
    ? null
    : {
        limitPerHour: rateLimitData.limitPerHour,
        observedAtMilliseconds: rateLimitData.observedAtMilliseconds,
        pointsResetIn: rateLimitData.pointsResetIn,
        pointsSpentThisHour: rateLimitData.pointsSpentThisHour,
      };
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

function createFellowshipLogsPointPoolApiResponse({
  hasRemainingPoints,
  limitPerHour,
  pointsRemaining,
  resetSource,
  resetsAtMilliseconds,
}: FellowshipLogsPointPools[keyof FellowshipLogsPointPools]) {
  return {
    hasRemainingPoints,
    limitPerHour,
    pointsRemaining,
    resetSource,
    resetsAtMilliseconds,
  };
}

export function createFellowshipLogsPointPoolsApiResponse(
  rateLimitData: FellowshipLogsRateLimitSnapshot | null,
  nowMilliseconds: number,
): FellowshipLogsApiPointPools {
  if (rateLimitData === null) {
    return null;
  }

  const pools = getFellowshipLogsPointPools(rateLimitData, nowMilliseconds);

  return {
    observedAtMilliseconds: rateLimitData.observedAtMilliseconds,
    pools: {
      APPLICATION: createFellowshipLogsPointPoolApiResponse(pools.APPLICATION),
      DATABASE: createFellowshipLogsPointPoolApiResponse(pools.DATABASE),
      USER: createFellowshipLogsPointPoolApiResponse(pools.USER),
    },
  };
}
