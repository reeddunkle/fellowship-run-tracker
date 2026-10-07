import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createAbilityApiResponse } from "@frt/api/services/ability-catalog/create-ability-api-response.ts";
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

export type AbilityCatalogShape = {
  readonly getAll: () => E.Effect<AbilityApiAbilityList, AbilityDAOError>;

  readonly getById: (
    options: GetAbilityByIdOptions,
  ) => E.Effect<Option.Option<AbilityApiAbility>, AbilityDAOError>;
};

const makeAbilityCatalog = E.gen(function* () {
  const abilityDAO = yield* AbilityDAO;

  const getAll: AbilityCatalogShape["getAll"] = E.fn("AbilityCatalog.getAll")(
    function* () {
      const abilities = yield* abilityDAO.getAll();

      return abilities.map(createAbilityApiResponse);
    },
  );

  const getById: AbilityCatalogShape["getById"] = E.fn(
    "AbilityCatalog.getById",
  )(function* ({ id }) {
    const ability = yield* abilityDAO.getById({ id });

    return Option.map(ability, createAbilityApiResponse);
  });

  return {
    getAll,
    getById,
  } satisfies AbilityCatalogShape;
});

export class AbilityCatalog extends Context.Service<
  AbilityCatalog,
  AbilityCatalogShape
>()(
  "@frt/api/services/ability-catalog/ability-catalog-service/AbilityCatalog",
) {
  static readonly layerNoDeps = Layer.effect(this, makeAbilityCatalog);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AbilityDAO.layer),
  );
}
