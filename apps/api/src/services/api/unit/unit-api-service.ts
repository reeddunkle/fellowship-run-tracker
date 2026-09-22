import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createUnitApiResponse } from "@frt/api/services/api/unit/create-unit-api-response.ts";
import { UnitDAO, type UnitDAOError } from "@frt/db/daos/unit/unit-dao.ts";
import {
  type UnitApiUnit,
  type UnitApiUnitList,
} from "@frt/shared/unit/unit-api-schema.ts";

type GetUnitByIdOptions = {
  readonly id: string;
};

export type UnitApiServiceShape = {
  readonly getAll: () => E.Effect<UnitApiUnitList, UnitDAOError>;

  readonly getById: (
    options: GetUnitByIdOptions,
  ) => E.Effect<Option.Option<UnitApiUnit>, UnitDAOError>;
};

const makeUnitApiService = E.gen(function* () {
  const unitDAO = yield* UnitDAO;

  const getAll: UnitApiServiceShape["getAll"] = () => {
    return unitDAO.getAll().pipe(
      E.map((units) => {
        return units.map(createUnitApiResponse);
      }),
    );
  };

  const getById: UnitApiServiceShape["getById"] = ({ id }) => {
    return unitDAO
      .getById({ id })
      .pipe(E.map(Option.map(createUnitApiResponse)));
  };

  return {
    getAll,
    getById,
  } satisfies UnitApiServiceShape;
});

export class UnitApiService extends Context.Service<
  UnitApiService,
  UnitApiServiceShape
>()("@frt/api/services/api/unit/unit-api-service/UnitApiService") {
  static readonly layerNoDeps = Layer.effect(this, makeUnitApiService);

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(UnitDAO.layer));
}
