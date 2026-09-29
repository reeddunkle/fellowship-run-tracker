import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import {
  DungeonApiDungeonListSchema,
  DungeonApiDungeonSchema,
} from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";

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
