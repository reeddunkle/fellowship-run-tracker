import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import {
  AbilityApiAbilityListSchema,
  AbilityApiAbilitySchema,
} from "@frt/shared/ability/ability-api-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const ABILITIES_ROUTE = "/abilities" as const;

const AbilityIdParamsSchema = Schema.Struct({
  id: NonEmptyStringSchema,
});

const GetAbilitiesEndpoint = HttpApiEndpoint.get(
  "getAbilities",
  ABILITIES_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: AbilityApiAbilityListSchema,
  },
);

const GetAbilityEndpoint = HttpApiEndpoint.get(
  "getAbility",
  `${ABILITIES_ROUTE}/:id`,
  {
    error: [
      HttpApiError.NotFoundNoContent,
      HttpApiError.InternalServerErrorNoContent,
    ],
    params: AbilityIdParamsSchema,
    success: AbilityApiAbilitySchema,
  },
);

export const AbilitiesApi = HttpApiGroup.make("abilities").add(
  GetAbilitiesEndpoint,
  GetAbilityEndpoint,
);
