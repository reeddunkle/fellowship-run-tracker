import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  FellowshipLogs,
  type FellowshipLogsShape,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

export type MakeFellowshipLogsMockOptions = Partial<FellowshipLogsShape>;

const MOCK_BACKGROUND_JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "00000000-0000-0000-0000-000000000000",
);

export function makeFellowshipLogsMock({
  deleteImportedDungeonRun = () => {
    return E.void;
  },
  getAnalyticsSummary = () => {
    return E.succeed({
      apiRequestCount: 0,
      cacheHitCount: 0,
      cacheHitRate: 0,
      estimatedPointsSaved: 0,
      pointsSpent: 0,
      trackingSinceMilliseconds: null,
    });
  },
  getDungeonRunMetadata = () => {
    return E.succeed({
      dungeonId: "0",
      dungeonLevel: 0,
      endedAtMilliseconds: DateTime.toEpochMillis(DateTime.makeUnsafe(0)),
      isInProgress: false,
      startedAtMilliseconds: DateTime.toEpochMillis(DateTime.makeUnsafe(0)),
    });
  },
  getImportedDungeonRuns = () => {
    return E.succeed([]);
  },
  getLastKnownRateLimitData = () => {
    return E.succeed(null);
  },
  getRateLimitData = () => {
    return E.succeed({
      limitPerHour: 1,
      observedAtMilliseconds: 0,
      pointsResetIn: 0,
      pointsSpentThisHour: 0,
    });
  },
  queueDungeonRunImport = (options) => {
    return E.succeed({
      job: {
        attempts: 0,
        availableAtMilliseconds: null,
        createdAtMilliseconds: 0,
        error: null,
        finishedAtMilliseconds: null,
        id: MOCK_BACKGROUND_JOB_ID,
        kind: "ImportFellowshipLogsDungeonRun",
        payload: options,
        progress: null,
        result: null,
        startedAtMilliseconds: null,
        status: "QUEUED",
      },
      wasAlreadyQueued: false,
    });
  },
}: MakeFellowshipLogsMockOptions = {}) {
  return Layer.succeed(FellowshipLogs, {
    deleteImportedDungeonRun,
    getAnalyticsSummary,
    getDungeonRunMetadata,
    getImportedDungeonRuns,
    getLastKnownRateLimitData,
    getRateLimitData,
    queueDungeonRunImport,
  } satisfies FellowshipLogsShape);
}

export const FellowshipLogsMock = makeFellowshipLogsMock();
