import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  EncounterDAO,
  type EncounterDAOError,
} from "@/db/daos/encounter/encounter-dao.ts";
import { createEncounterApiResponse } from "@/services/api/encounter/create-encounter-api-response.ts";
import {
  type EncounterApiEncounter,
  type EncounterApiEncounterList,
} from "@/services/api/encounter/encounter-api-schema.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

type GetEncounterByIdOptions = {
  readonly dungeonId: DungeonId;
  readonly id: string;
};

export type EncounterApiServiceShape = {
  readonly getAll: () => E.Effect<EncounterApiEncounterList, EncounterDAOError>;

  readonly getById: (
    options: GetEncounterByIdOptions,
  ) => E.Effect<Option.Option<EncounterApiEncounter>, EncounterDAOError>;
};

export class EncounterApiService extends Context.Service<
  EncounterApiService,
  EncounterApiServiceShape
>()(
  "fellowship-run-tracker/services/api/encounter/encounter-api-service/EncounterApiService",
) {}

const make = E.gen(function* () {
  const encounterDAO = yield* EncounterDAO;

  const getAll: EncounterApiServiceShape["getAll"] = () => {
    return encounterDAO.getAll().pipe(
      E.map((encounters) => {
        return encounters.map(createEncounterApiResponse);
      }),
    );
  };

  const getById: EncounterApiServiceShape["getById"] = ({ dungeonId, id }) => {
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
  } satisfies EncounterApiServiceShape;
});

export const EncounterApiServiceLive = Layer.effect(EncounterApiService, make);
