import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  type AbilityApiAbility,
  type AbilityApiAbilityList,
} from "@/contracts/ability/ability-api-schema.ts";
import {
  AbilityDAO,
  type AbilityDAOError,
} from "@/db/daos/ability/ability-dao.ts";
import { createAbilityApiResponse } from "@/services/api/ability/create-ability-api-response.ts";

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
>()(
  "fellowship-run-tracker/services/api/ability/ability-api-service/AbilityApiService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeAbilityApiService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AbilityDAO.layer),
  );
}
