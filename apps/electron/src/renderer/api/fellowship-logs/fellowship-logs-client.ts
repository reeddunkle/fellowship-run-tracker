import * as E from "effect/Effect";

import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import {
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiQueueDungeonRunImportOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

export const getRateLimitData = E.fn(
  "FellowshipLogsApiClient.getRateLimitData",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogs.getFellowshipLogsRateLimitData();
});

export const getLastKnownRateLimitData = E.fn(
  "FellowshipLogsApiClient.getLastKnownRateLimitData",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogs.getFellowshipLogsLastKnownRateLimitData();
});

export const getAnalytics = E.fn("FellowshipLogsApiClient.getAnalytics")(
  function* () {
    const client = yield* AppApiClient;

    return yield* client.fellowshipLogs.getFellowshipLogsAnalytics();
  },
);

export const getDungeonRunMetadata = E.fn(
  "FellowshipLogsApiClient.getDungeonRunMetadata",
)(function* (options: FellowshipLogsApiDungeonRunReference) {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogs.getFellowshipLogsDungeonRunMetadata({
    payload: options,
  });
});

export const queueDungeonRunImport = E.fn(
  "FellowshipLogsApiClient.queueDungeonRunImport",
)(function* (options: FellowshipLogsApiQueueDungeonRunImportOptions) {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogs.queueFellowshipLogsDungeonRunImport({
    payload: options,
  });
});

export const getImportedDungeonRuns = E.fn(
  "FellowshipLogsApiClient.getImportedDungeonRuns",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.fellowshipLogs.getFellowshipLogsDungeonRuns();
});

export type DeleteImportedDungeonRunArgs = {
  readonly dungeonRunId: DungeonRunId;
};

export const deleteImportedDungeonRun = E.fn(
  "FellowshipLogsApiClient.deleteImportedDungeonRun",
)(function* ({ dungeonRunId }: DeleteImportedDungeonRunArgs) {
  const client = yield* AppApiClient;

  yield* client.fellowshipLogs.deleteFellowshipLogsDungeonRun({
    params: {
      dungeonRunId,
    },
  });
});
