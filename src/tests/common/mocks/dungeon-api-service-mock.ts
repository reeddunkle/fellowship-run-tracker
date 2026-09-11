import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  DungeonApiService,
  type DungeonApiServiceShape,
} from "@/services/api/dungeon/dungeon-api-service.ts";

export type MakeDungeonApiServiceMockOptions = Partial<DungeonApiServiceShape>;

function makeDungeonApiServiceMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeDungeonApiServiceMockOptions = {}) {
  return Layer.succeed(DungeonApiService, {
    getAll,
    getById,
  } satisfies DungeonApiServiceShape);
}

export const DungeonApiServiceMock = makeDungeonApiServiceMock();
