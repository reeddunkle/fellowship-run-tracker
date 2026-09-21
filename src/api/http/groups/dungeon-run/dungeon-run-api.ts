import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { DungeonRunApiHistorySchema } from "@/contracts/dungeon-run/dungeon-run-api-schema.ts";
import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { PositiveIntegerFromStringSchema } from "@/validation/common-schemas.ts";

const DUNGEON_RUNS_ROUTE = "/dungeon-run" as const;

const DungeonRunHistoryParamsSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerFromStringSchema,
});

const DeleteDungeonRunHistoryEndpoint = HttpApiEndpoint.delete(
  "deleteDungeonRunHistory",
  `${DUNGEON_RUNS_ROUTE}/history/:dungeonId/:dungeonLevel`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    params: DungeonRunHistoryParamsSchema,
    success: Schema.Void,
  },
);

const GetDungeonRunHistoryEndpoint = HttpApiEndpoint.get(
  "getDungeonRunHistory",
  `${DUNGEON_RUNS_ROUTE}/history/:dungeonId/:dungeonLevel`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    params: DungeonRunHistoryParamsSchema,
    success: DungeonRunApiHistorySchema,
  },
);

export const DungeonRunApi = HttpApiGroup.make("dungeonRun")
  .add(DeleteDungeonRunHistoryEndpoint)
  .add(GetDungeonRunHistoryEndpoint);
