import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  EncounterApiService,
  type EncounterApiServiceShape,
} from "@/services/api/encounter/encounter-api-service.ts";

export type MakeEncounterApiServiceMockOptions =
  Partial<EncounterApiServiceShape>;

export function makeEncounterApiServiceMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeEncounterApiServiceMockOptions = {}) {
  return Layer.succeed(EncounterApiService, {
    getAll,
    getById,
  } satisfies EncounterApiServiceShape);
}

export const EncounterApiServiceMock = makeEncounterApiServiceMock();
