import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createAbilityApiResponse } from "@frt/api/services/api/ability/create-ability-api-response.ts";
import {
  AbilityDAO,
  type AbilityDAOError,
} from "@frt/db/daos/ability/ability-dao.ts";
import {
  type AbilityApiAbility,
  type AbilityApiAbilityList,
} from "@frt/shared/ability/ability-api-schema.ts";

type GetAbilityByIdOptions = {
  readonly id: string;
};

export type AbilityApiServiceShape = {
  readonly getAll: () => E.Effect<AbilityApiAbilityList, AbilityDAOError>;

  readonly getById: (
    options: GetAbilityByIdOptions,
  ) => E.Effect<Option.Option<AbilityApiAbility>, AbilityDAOError>;
};

const makeAbilityApiService = E.gen(function* () {
  const abilityDAO = yield* AbilityDAO;

  const getAll: AbilityApiServiceShape["getAll"] = () => {
    return abilityDAO.getAll().pipe(
      E.map((abilities) => {
        return abilities.map(createAbilityApiResponse);
      }),
    );
  };

  const getById: AbilityApiServiceShape["getById"] = ({ id }) => {
    return abilityDAO
      .getById({ id })
      .pipe(E.map(Option.map(createAbilityApiResponse)));
  };

  return {
    getAll,
    getById,
  } satisfies AbilityApiServiceShape;
});

export class AbilityApiService extends Context.Service<
  AbilityApiService,
  AbilityApiServiceShape
>()("@frt/api/services/api/ability/ability-api-service/AbilityApiService") {
  static readonly layerNoDeps = Layer.effect(this, makeAbilityApiService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AbilityDAO.layer),
  );
}
