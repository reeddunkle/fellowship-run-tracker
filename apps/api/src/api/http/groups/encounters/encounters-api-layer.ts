import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { EncounterApiService } from "@frt/api/services/api/encounter/encounter-api-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type EncounterDAOError } from "@frt/db/daos/encounter/encounter-dao.ts";

function mapEncounterApiError(
  error: EncounterDAOError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Encounter API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const EncountersApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "encounters",
  E.fn(function* (handlers) {
    const encounterApiService = yield* EncounterApiService;

    return handlers
      .handle("getEncounters", () => {
        return encounterApiService.getAll().pipe(E.catch(mapEncounterApiError));
      })
      .handle("getEncounter", ({ params }) => {
        return E.gen(function* () {
          const encounter = yield* encounterApiService
            .getById({
              dungeonId: params.dungeonId,
              id: params.id,
            })
            .pipe(E.catch(mapEncounterApiError));

          if (Option.isNone(encounter)) {
            return yield* new HttpApiError.NotFound();
          }

          return encounter.value;
        });
      });
  }),
);

export const EncountersApiLayer: Layer.Layer<
  Layer.Success<typeof EncountersApiHandlersInferred>,
  Layer.Error<typeof EncountersApiHandlersInferred>,
  EncounterApiService
> = EncountersApiHandlersInferred;
