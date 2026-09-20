import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  DungeonRunApiService,
  type DungeonRunApiServiceShape,
} from "@/services/api/dungeon-run/dungeon-run-api-service.ts";

export type MakeDungeonRunApiServiceMockOptions =
  Partial<DungeonRunApiServiceShape>;

function makeDungeonRunApiServiceMock({
  deleteHistory = () => {
    return E.void;
  },
  getHistory = () => {
    return E.succeed({
      comparisonRunCount: 0,
      comparisonSampleCount: 0,
      observations: [],
      ownRunCount: 0,
      ownSampleCount: 0,
    });
  },
}: MakeDungeonRunApiServiceMockOptions = {}) {
  return Layer.succeed(DungeonRunApiService, {
    deleteHistory,
    getHistory,
  } satisfies DungeonRunApiServiceShape);
}

export const DungeonRunApiServiceMock = makeDungeonRunApiServiceMock();
