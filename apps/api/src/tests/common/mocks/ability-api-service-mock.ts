import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  AbilityApiService,
  type AbilityApiServiceShape,
} from "@frt/api/services/api/ability/ability-api-service.ts";

export type MakeAbilityApiServiceMockOptions = Partial<AbilityApiServiceShape>;

export function makeAbilityApiServiceMock({
  getAll = () => {
    return E.succeed([]);
  },
  getById = () => {
    return E.succeedNone;
  },
}: MakeAbilityApiServiceMockOptions = {}) {
  return Layer.succeed(AbilityApiService, {
    getAll,
    getById,
  } satisfies AbilityApiServiceShape);
}

export const AbilityApiServiceMock = makeAbilityApiServiceMock();
