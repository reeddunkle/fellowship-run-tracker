import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  DungeonCatalog,
  type DungeonCatalogShape,
} from "@frt/api/services/dungeon-catalog/dungeon-catalog-service.ts";

export type MakeDungeonCatalogMockOptions = Partial<DungeonCatalogShape>;

function makeDungeonCatalogMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeDungeonCatalogMockOptions = {}) {
  return Layer.succeed(DungeonCatalog, {
    getAll,
    getById,
  } satisfies DungeonCatalogShape);
}

export const DungeonCatalogMock = makeDungeonCatalogMock();
