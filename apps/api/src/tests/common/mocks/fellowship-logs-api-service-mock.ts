import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  FellowshipLogsApiService,
  type FellowshipLogsApiServiceShape,
} from "@frt/api/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { BackgroundJobIdSchema } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

export type MakeFellowshipLogsApiServiceMockOptions =
  Partial<FellowshipLogsApiServiceShape>;

const MOCK_BACKGROUND_JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "00000000-0000-0000-0000-000000000000",
);

export function makeFellowshipLogsApiServiceMock({
  deleteImportedDungeonRun = () => {
    return E.void;
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
}: MakeFellowshipLogsApiServiceMockOptions = {}) {
  return Layer.succeed(FellowshipLogsApiService, {
    deleteImportedDungeonRun,
    getDungeonRunMetadata,
    getImportedDungeonRuns,
    getLastKnownRateLimitData,
    getRateLimitData,
    queueDungeonRunImport,
  } satisfies FellowshipLogsApiServiceShape);
}

export const FellowshipLogsApiServiceMock = makeFellowshipLogsApiServiceMock();
