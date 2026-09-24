import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { EncounterCatalog } from "@frt/api/services/encounter-catalog/encounter-catalog-service.ts";
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
    const encounterCatalog = yield* EncounterCatalog;

    return handlers
      .handle("getEncounters", () => {
        return encounterCatalog.getAll().pipe(E.catch(mapEncounterApiError));
      })
      .handle("getEncounter", ({ params }) => {
        return E.gen(function* () {
          const encounter = yield* encounterCatalog
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
  EncounterCatalog
> = EncountersApiHandlersInferred;
