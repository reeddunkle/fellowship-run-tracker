import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  UnitCatalog,
  type UnitCatalogShape,
} from "@frt/api/services/unit-catalog/unit-catalog-service.ts";

export type MakeUnitCatalogMockOptions = Partial<UnitCatalogShape>;

export function makeUnitCatalogMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeUnitCatalogMockOptions = {}) {
  return Layer.succeed(UnitCatalog, {
    getAll,
    getById,
  } satisfies UnitCatalogShape);
}

export const UnitCatalogMock = makeUnitCatalogMock();
