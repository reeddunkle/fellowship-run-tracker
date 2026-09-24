import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  EncounterCatalog,
  type EncounterCatalogShape,
} from "@frt/api/services/encounter-catalog/encounter-catalog-service.ts";

export type MakeEncounterCatalogMockOptions = Partial<EncounterCatalogShape>;

export function makeEncounterCatalogMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeEncounterCatalogMockOptions = {}) {
  return Layer.succeed(EncounterCatalog, {
    getAll,
    getById,
  } satisfies EncounterCatalogShape);
}

export const EncounterCatalogMock = makeEncounterCatalogMock();
