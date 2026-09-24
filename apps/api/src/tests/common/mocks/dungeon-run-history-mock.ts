import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  DungeonRunHistory,
  type DungeonRunHistoryShape,
} from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";

export type MakeDungeonRunHistoryMockOptions = Partial<DungeonRunHistoryShape>;

function makeDungeonRunHistoryMock({
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
}: MakeDungeonRunHistoryMockOptions = {}) {
  return Layer.succeed(DungeonRunHistory, {
    deleteHistory,
    getHistory,
  } satisfies DungeonRunHistoryShape);
}

export const DungeonRunHistoryMock = makeDungeonRunHistoryMock();
