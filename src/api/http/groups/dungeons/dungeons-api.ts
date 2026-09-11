import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  DungeonApiDungeonListSchema,
  DungeonApiDungeonSchema,
} from "@/services/api/dungeon/dungeon-api-schema.ts";
import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";

const DUNGEONS_ROUTE = "/dungeons" as const;

const DungeonIdParamsSchema = Schema.Struct({
  id: DungeonIdSchema,
});

const GetDungeonsEndpoint = HttpApiEndpoint.get("getDungeons", DUNGEONS_ROUTE, {
  error: HttpApiError.InternalServerErrorNoContent,
  success: DungeonApiDungeonListSchema,
});

const GetDungeonEndpoint = HttpApiEndpoint.get(
  "getDungeon",
  `${DUNGEONS_ROUTE}/:id`,
  {
    error: [
      HttpApiError.NotFoundNoContent,
      HttpApiError.InternalServerErrorNoContent,
    ],
    params: DungeonIdParamsSchema,
    success: DungeonApiDungeonSchema,
  },
);

export const DungeonsApi = HttpApiGroup.make("dungeons").add(
  GetDungeonsEndpoint,
  GetDungeonEndpoint,
);
