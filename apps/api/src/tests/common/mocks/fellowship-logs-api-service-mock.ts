import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  FellowshipLogsApiService,
  type FellowshipLogsApiServiceShape,
} from "@frt/api/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

export type MakeFellowshipLogsApiServiceMockOptions =
  Partial<FellowshipLogsApiServiceShape>;

const MOCK_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
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
      limitPerHour: 0,
      pointsResetIn: 0,
      pointsSpentThisHour: 0,
    });
  },
  importDungeonRun = () => {
    return E.succeed({
      dungeonRunId: MOCK_DUNGEON_RUN_ID,
    });
  },
}: MakeFellowshipLogsApiServiceMockOptions = {}) {
  return Layer.succeed(FellowshipLogsApiService, {
    deleteImportedDungeonRun,
    getDungeonRunMetadata,
    getImportedDungeonRuns,
    getLastKnownRateLimitData,
    getRateLimitData,
    importDungeonRun,
  } satisfies FellowshipLogsApiServiceShape);
}

export const FellowshipLogsApiServiceMock = makeFellowshipLogsApiServiceMock();
