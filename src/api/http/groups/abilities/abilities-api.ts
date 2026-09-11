import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  AbilityApiAbilityListSchema,
  AbilityApiAbilitySchema,
} from "@/services/api/ability/ability-api-schema.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

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
