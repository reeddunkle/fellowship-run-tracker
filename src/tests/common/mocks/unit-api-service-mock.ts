import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  UnitApiService,
  type UnitApiServiceShape,
} from "@/services/api/unit/unit-api-service.ts";

export type MakeUnitApiServiceMockOptions = Partial<UnitApiServiceShape>;

export function makeUnitApiServiceMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeUnitApiServiceMockOptions = {}) {
  return Layer.succeed(UnitApiService, {
    getAll,
    getById,
  } satisfies UnitApiServiceShape);
}

export const UnitApiServiceMock = makeUnitApiServiceMock();
