import * as Layer from "effect/Layer";

import {
  AbilityCatalog,
  type AbilityCatalogShape,
} from "@frt/api/services/ability-catalog/ability-catalog-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeAbilityCatalogMockOptions = Partial<AbilityCatalogShape>;

export function makeAbilityCatalogMock({
  getAll = unexpectedEffectCall("AbilityCatalog", "getAll"),
  getById = unexpectedEffectCall("AbilityCatalog", "getById"),
}: MakeAbilityCatalogMockOptions = {}) {
  return Layer.succeed(AbilityCatalog, {
    getAll,
    getById,
  } satisfies AbilityCatalogShape);
}

export const AbilityCatalogMock = makeAbilityCatalogMock();
