import * as Layer from "effect/Layer";

import {
  EncounterCatalog,
  type EncounterCatalogShape,
} from "@frt/api/services/encounter-catalog/encounter-catalog-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeEncounterCatalogMockOptions = Partial<EncounterCatalogShape>;

export function makeEncounterCatalogMock({
  getAll = unexpectedEffectCall("EncounterCatalog", "getAll"),
  getById = unexpectedEffectCall("EncounterCatalog", "getById"),
}: MakeEncounterCatalogMockOptions = {}) {
  return Layer.succeed(EncounterCatalog, {
    getAll,
    getById,
  } satisfies EncounterCatalogShape);
}

export const EncounterCatalogMock = makeEncounterCatalogMock();
