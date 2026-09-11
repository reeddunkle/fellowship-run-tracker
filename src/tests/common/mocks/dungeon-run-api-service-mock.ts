import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  DungeonRunApiService,
  type DungeonRunApiServiceShape,
} from "@/services/api/dungeon-run/dungeon-run-api-service.ts";

export type MakeDungeonRunApiServiceMockOptions =
  Partial<DungeonRunApiServiceShape>;

function makeDungeonRunApiServiceMock({
  getHistory = () => {
    return E.succeedNone;
  },
}: MakeDungeonRunApiServiceMockOptions = {}) {
  return Layer.succeed(DungeonRunApiService, {
    getHistory,
  } satisfies DungeonRunApiServiceShape);
}

export const DungeonRunApiServiceMock = makeDungeonRunApiServiceMock();
