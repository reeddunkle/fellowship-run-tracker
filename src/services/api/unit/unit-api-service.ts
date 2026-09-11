import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UnitDAO, type UnitDAOError } from "@/db/daos/unit/unit-dao.ts";
import { createUnitApiResponse } from "@/services/api/unit/create-unit-api-response.ts";
import {
  type UnitApiUnit,
  type UnitApiUnitList,
} from "@/services/api/unit/unit-api-schema.ts";

type GetUnitByIdOptions = {
  readonly id: string;
};

export type UnitApiServiceShape = {
  readonly getAll: () => E.Effect<UnitApiUnitList, UnitDAOError>;

  readonly getById: (
    options: GetUnitByIdOptions,
  ) => E.Effect<Option.Option<UnitApiUnit>, UnitDAOError>;
};

export class UnitApiService extends Context.Service<
  UnitApiService,
  UnitApiServiceShape
>()(
  "fellowship-run-tracker/services/api/unit/unit-api-service/UnitApiService",
) {}

const make = E.gen(function* () {
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

export const UnitApiServiceLive = Layer.effect(UnitApiService, make);
