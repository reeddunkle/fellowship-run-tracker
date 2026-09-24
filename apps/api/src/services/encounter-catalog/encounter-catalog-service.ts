import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createEncounterApiResponse } from "@frt/api/services/encounter-catalog/create-encounter-api-response.ts";
import {
  EncounterDAO,
  type EncounterDAOError,
} from "@frt/db/daos/encounter/encounter-dao.ts";
import {
  type EncounterApiEncounter,
  type EncounterApiEncounterList,
} from "@frt/shared/encounter/encounter-api-schema.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

type GetEncounterByIdOptions = {
  readonly dungeonId: DungeonId;
  readonly id: string;
};

export type EncounterCatalogShape = {
  readonly getAll: () => E.Effect<EncounterApiEncounterList, EncounterDAOError>;

  readonly getById: (
    options: GetEncounterByIdOptions,
  ) => E.Effect<Option.Option<EncounterApiEncounter>, EncounterDAOError>;
};

const makeEncounterCatalog = E.gen(function* () {
  const encounterDAO = yield* EncounterDAO;

  const getAll: EncounterCatalogShape["getAll"] = () => {
    return encounterDAO.getAll().pipe(
      E.map((encounters) => {
        return encounters.map(createEncounterApiResponse);
      }),
    );
  };

  const getById: EncounterCatalogShape["getById"] = ({ dungeonId, id }) => {
    return encounterDAO
      .getById({
        dungeonId,
        id,
      })
      .pipe(E.map(Option.map(createEncounterApiResponse)));
  };

  return {
    getAll,
    getById,
  } satisfies EncounterCatalogShape;
});

export class EncounterCatalog extends Context.Service<
  EncounterCatalog,
  EncounterCatalogShape
>()(
  "@frt/api/services/encounter-catalog/encounter-catalog-service/EncounterCatalog",
) {
  static readonly layerNoDeps = Layer.effect(this, makeEncounterCatalog);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(EncounterDAO.layer),
  );
}
