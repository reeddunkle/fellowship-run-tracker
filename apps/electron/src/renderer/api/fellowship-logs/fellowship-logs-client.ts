import * as E from "effect/Effect";

import {
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiQueueDungeonRunImportOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export function getRateLimitData() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.fellowshipLogs.getFellowshipLogsRateLimitData();
  });
}

export function getLastKnownRateLimitData() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.fellowshipLogs.getFellowshipLogsLastKnownRateLimitData();
  });
}

export function getDungeonRunMetadata(
  options: FellowshipLogsApiDungeonRunReference,
) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.fellowshipLogs.getFellowshipLogsDungeonRunMetadata({
      payload: options,
    });
  });
}

export function queueDungeonRunImport(
  options: FellowshipLogsApiQueueDungeonRunImportOptions,
) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.fellowshipLogs.queueFellowshipLogsDungeonRunImport({
      payload: options,
    });
  });
}

export function getImportedDungeonRuns() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.fellowshipLogs.getFellowshipLogsDungeonRuns();
  });
}

export type DeleteImportedDungeonRunArgs = {
  readonly dungeonRunId: DungeonRunId;
};

export function deleteImportedDungeonRun({
  dungeonRunId,
}: DeleteImportedDungeonRunArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.fellowshipLogs.deleteFellowshipLogsDungeonRun({
      params: {
        dungeonRunId,
      },
    });
  });
}
