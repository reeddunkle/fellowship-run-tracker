import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import {
  EncounterApiEncounterListSchema,
  EncounterApiEncounterSchema,
} from "@frt/shared/encounter/encounter-api-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const ENCOUNTERS_ROUTE = "/encounters" as const;

const EncounterIdParamsSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  id: NonEmptyStringSchema,
});

const GetEncountersEndpoint = HttpApiEndpoint.get(
  "getEncounters",
  ENCOUNTERS_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: EncounterApiEncounterListSchema,
  },
);

const GetEncounterEndpoint = HttpApiEndpoint.get(
  "getEncounter",
  `${ENCOUNTERS_ROUTE}/:dungeonId/:id`,
  {
    error: [
      HttpApiError.NotFoundNoContent,
      HttpApiError.InternalServerErrorNoContent,
    ],
    params: EncounterIdParamsSchema,
    success: EncounterApiEncounterSchema,
  },
);

export const EncountersApi = HttpApiGroup.make("encounters").add(
  GetEncountersEndpoint,
  GetEncounterEndpoint,
);
