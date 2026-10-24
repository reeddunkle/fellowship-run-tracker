import * as Layer from "effect/Layer";

import {
  DungeonRunHistory,
  type DungeonRunHistoryShape,
} from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeDungeonRunHistoryMockOptions = Partial<DungeonRunHistoryShape>;

function makeDungeonRunHistoryMock({
  deleteHistory = unexpectedEffectCall("DungeonRunHistory", "deleteHistory"),
  getHistory = unexpectedEffectCall("DungeonRunHistory", "getHistory"),
}: MakeDungeonRunHistoryMockOptions = {}) {
  return Layer.succeed(DungeonRunHistory, {
    deleteHistory,
    getHistory,
  } satisfies DungeonRunHistoryShape);
}

export const DungeonRunHistoryMock = makeDungeonRunHistoryMock();
