import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AbilityCatalog } from "@frt/api/services/ability-catalog/ability-catalog-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type AbilityDAOError } from "@frt/db/daos/ability/ability-dao.ts";

function mapAbilityApiError(
  error: AbilityDAOError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Ability API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const AbilitiesApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "abilities",
  E.fn(function* (handlers) {
    const abilityCatalog = yield* AbilityCatalog;

    return handlers
      .handle("getAbilities", () => {
        return abilityCatalog.getAll().pipe(E.catch(mapAbilityApiError));
      })
      .handle("getAbility", ({ params }) => {
        return E.gen(function* () {
          const ability = yield* abilityCatalog
            .getById({
              id: params.id,
            })
            .pipe(E.catch(mapAbilityApiError));

          if (Option.isNone(ability)) {
            return yield* new HttpApiError.NotFound();
          }

          return ability.value;
        });
      });
  }),
);

export const AbilitiesApiLayer: Layer.Layer<
  Layer.Success<typeof AbilitiesApiHandlersInferred>,
  Layer.Error<typeof AbilitiesApiHandlersInferred>,
  AbilityCatalog
> = AbilitiesApiHandlersInferred;
