import * as Layer from "effect/Layer";

import {
  UnitCatalog,
  type UnitCatalogShape,
} from "@frt/api/services/unit-catalog/unit-catalog-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeUnitCatalogMockOptions = Partial<UnitCatalogShape>;

export function makeUnitCatalogMock({
  getAll = unexpectedEffectCall("UnitCatalog", "getAll"),
  getById = unexpectedEffectCall("UnitCatalog", "getById"),
}: MakeUnitCatalogMockOptions = {}) {
  return Layer.succeed(UnitCatalog, {
    getAll,
    getById,
  } satisfies UnitCatalogShape);
}

export const UnitCatalogMock = makeUnitCatalogMock();
