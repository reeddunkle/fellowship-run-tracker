import * as Layer from "effect/Layer";

import {
  DungeonCatalog,
  type DungeonCatalogShape,
} from "@frt/api/services/dungeon-catalog/dungeon-catalog-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeDungeonCatalogMockOptions = Partial<DungeonCatalogShape>;

function makeDungeonCatalogMock({
  getAll = unexpectedEffectCall("DungeonCatalog", "getAll"),
  getById = unexpectedEffectCall("DungeonCatalog", "getById"),
}: MakeDungeonCatalogMockOptions = {}) {
  return Layer.succeed(DungeonCatalog, {
    getAll,
    getById,
  } satisfies DungeonCatalogShape);
}

export const DungeonCatalogMock = makeDungeonCatalogMock();
