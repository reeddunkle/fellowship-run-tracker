import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  EncounterApiEncounterListSchema,
  EncounterApiEncounterSchema,
} from "@/services/api/encounter/encounter-api-schema.ts";
import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

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
