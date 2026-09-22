import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AbilityApiService } from "@frt/api/services/api/ability/ability-api-service.ts";
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
    const abilityApiService = yield* AbilityApiService;

    return handlers
      .handle("getAbilities", () => {
        return abilityApiService.getAll().pipe(E.catch(mapAbilityApiError));
      })
      .handle("getAbility", ({ params }) => {
        return E.gen(function* () {
          const ability = yield* abilityApiService
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
  AbilityApiService
> = AbilitiesApiHandlersInferred;
