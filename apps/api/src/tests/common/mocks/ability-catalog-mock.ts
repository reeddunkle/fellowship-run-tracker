import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  AbilityCatalog,
  type AbilityCatalogShape,
} from "@frt/api/services/ability-catalog/ability-catalog-service.ts";

export type MakeAbilityCatalogMockOptions = Partial<AbilityCatalogShape>;

export function makeAbilityCatalogMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeAbilityCatalogMockOptions = {}) {
  return Layer.succeed(AbilityCatalog, {
    getAll,
    getById,
  } satisfies AbilityCatalogShape);
}

export const AbilityCatalogMock = makeAbilityCatalogMock();
