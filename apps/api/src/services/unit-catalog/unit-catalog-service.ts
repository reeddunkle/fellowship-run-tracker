import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createUnitApiResponse } from "@frt/api/services/unit-catalog/create-unit-api-response.ts";
import { UnitDAO, type UnitDAOError } from "@frt/db/daos/unit/unit-dao.ts";
import {
  type UnitApiUnit,
  type UnitApiUnitList,
} from "@frt/shared/unit/unit-api-schema.ts";

type GetUnitByIdOptions = {
  readonly id: string;
};

export type UnitCatalogShape = {
  readonly getAll: () => E.Effect<UnitApiUnitList, UnitDAOError>;

  readonly getById: (
    options: GetUnitByIdOptions,
  ) => E.Effect<Option.Option<UnitApiUnit>, UnitDAOError>;
};

const makeUnitCatalog = E.gen(function* () {
  const unitDAO = yield* UnitDAO;

  const getAll: UnitCatalogShape["getAll"] = () => {
    return unitDAO.getAll().pipe(
      E.map((units) => {
        return units.map(createUnitApiResponse);
      }),
    );
  };

  const getById: UnitCatalogShape["getById"] = ({ id }) => {
    return unitDAO
      .getById({ id })
      .pipe(E.map(Option.map(createUnitApiResponse)));
  };

  return {
    getAll,
    getById,
  } satisfies UnitCatalogShape;
});

export class UnitCatalog extends Context.Service<
  UnitCatalog,
  UnitCatalogShape
>()("@frt/api/services/unit-catalog/unit-catalog-service/UnitCatalog") {
  static readonly layerNoDeps = Layer.effect(this, makeUnitCatalog);

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(UnitDAO.layer));
}
