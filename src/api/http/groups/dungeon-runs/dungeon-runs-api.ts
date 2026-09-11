import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { DungeonRunApiHistorySchema } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { ConfigurationIdSchema } from "@/validation/configuration/configuration-id-schema.ts";

const DUNGEON_RUNS_ROUTE = "/dungeon-runs" as const;

const DungeonRunHistoryParamsSchema = Schema.Struct({
  configurationId: ConfigurationIdSchema,
});

const GetDungeonRunHistoryEndpoint = HttpApiEndpoint.get(
  "getDungeonRunHistory",
  `${DUNGEON_RUNS_ROUTE}/history/:configurationId`,
  {
    error: [
      HttpApiError.NotFoundNoContent,
      HttpApiError.InternalServerErrorNoContent,
    ],
    params: DungeonRunHistoryParamsSchema,
    success: DungeonRunApiHistorySchema,
  },
);

export const DungeonRunsApi = HttpApiGroup.make("dungeonRuns").add(
  GetDungeonRunHistoryEndpoint,
);
