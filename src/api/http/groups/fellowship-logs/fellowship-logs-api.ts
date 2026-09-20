import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  FellowshipLogsApiRunNotFinishedErrorSchema,
  FellowshipLogsApiRunNotFoundErrorSchema,
} from "@/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  FellowshipLogsApiDungeonRunMetadataSchema,
  FellowshipLogsApiDungeonRunReferenceSchema,
  FellowshipLogsApiImportDungeonRunOptionsSchema,
  FellowshipLogsApiImportDungeonRunResultSchema,
  FellowshipLogsApiImportedDungeonRunListSchema,
  FellowshipLogsApiLastKnownRateLimitDataSchema,
} from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

const FELLOWSHIP_LOGS_ROUTE = "/fellowship-logs" as const;

const DungeonRunIdParamsSchema = Schema.Struct({
  dungeonRunId: DungeonRunIdSchema,
});

const GetFellowshipLogsDungeonRunMetadataEndpoint = HttpApiEndpoint.post(
  "getFellowshipLogsDungeonRunMetadata",
  `${FELLOWSHIP_LOGS_ROUTE}/dungeon-run-metadata`,
  {
    error: [
      FellowshipLogsApiRunNotFoundErrorSchema,
      FellowshipLogsApiRunNotFinishedErrorSchema,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiDungeonRunReferenceSchema,
    success: FellowshipLogsApiDungeonRunMetadataSchema,
  },
);

const GetFellowshipLogsRateLimitDataEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsRateLimitData",
  `${FELLOWSHIP_LOGS_ROUTE}/rate-limit-data`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiLastKnownRateLimitDataSchema,
  },
);

const GetFellowshipLogsLastKnownRateLimitDataEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsLastKnownRateLimitData",
  `${FELLOWSHIP_LOGS_ROUTE}/rate-limit-data/last-known`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiLastKnownRateLimitDataSchema,
  },
);

const ImportFellowshipLogsDungeonRunEndpoint = HttpApiEndpoint.post(
  "importFellowshipLogsDungeonRun",
  `${FELLOWSHIP_LOGS_ROUTE}/dungeon-runs`,
  {
    error: [
      FellowshipLogsApiRunNotFoundErrorSchema,
      FellowshipLogsApiRunNotFinishedErrorSchema,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiImportDungeonRunOptionsSchema,
    success: FellowshipLogsApiImportDungeonRunResultSchema,
  },
);

const GetFellowshipLogsDungeonRunsEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsDungeonRuns",
  `${FELLOWSHIP_LOGS_ROUTE}/dungeon-runs`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiImportedDungeonRunListSchema,
  },
);

const DeleteFellowshipLogsDungeonRunEndpoint = HttpApiEndpoint.delete(
  "deleteFellowshipLogsDungeonRun",
  `${FELLOWSHIP_LOGS_ROUTE}/dungeon-runs/:dungeonRunId`,
  {
    error: [
      HttpApiError.NotFoundNoContent,
      HttpApiError.InternalServerErrorNoContent,
    ],
    params: DungeonRunIdParamsSchema,
    success: Schema.Void,
  },
);

export const FellowshipLogsApi = HttpApiGroup.make("fellowshipLogs")
  .add(GetFellowshipLogsDungeonRunMetadataEndpoint)
  .add(GetFellowshipLogsRateLimitDataEndpoint)
  .add(GetFellowshipLogsLastKnownRateLimitDataEndpoint)
  .add(ImportFellowshipLogsDungeonRunEndpoint)
  .add(GetFellowshipLogsDungeonRunsEndpoint)
  .add(DeleteFellowshipLogsDungeonRunEndpoint);
