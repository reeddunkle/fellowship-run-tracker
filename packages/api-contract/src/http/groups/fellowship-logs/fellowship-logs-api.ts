import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";

import {
  FellowshipLogsApiAlreadyImportedError,
  FellowshipLogsApiDungeonLevelNotFoundError,
  FellowshipLogsApiRateLimitExceededError,
  FellowshipLogsApiRunNotFinishedError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import {
  FellowshipLogsApiDungeonRunMetadataSchema,
  FellowshipLogsApiDungeonRunReferenceSchema,
  FellowshipLogsApiImportedDungeonRunListSchema,
  FellowshipLogsApiLastKnownRateLimitDataSchema,
  FellowshipLogsApiQueueDungeonRunImportOptionsSchema,
  FellowshipLogsApiQueueDungeonRunImportResultSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

const FELLOWSHIP_LOGS_ROUTE = "/fellowship-logs" as const;

const DungeonRunIdParamsSchema = Schema.Struct({
  dungeonRunId: DungeonRunIdSchema,
});

const GetFellowshipLogsDungeonRunMetadataEndpoint = HttpApiEndpoint.post(
  "getFellowshipLogsDungeonRunMetadata",
  `${FELLOWSHIP_LOGS_ROUTE}/dungeon-run-metadata`,
  {
    error: [
      FellowshipLogsApiDungeonLevelNotFoundError,
      FellowshipLogsApiRateLimitExceededError,
      FellowshipLogsApiRunNotFoundError,
      FellowshipLogsApiRunNotFinishedError,
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
    error: [
      FellowshipLogsApiRateLimitExceededError,
      HttpApiError.InternalServerErrorNoContent,
    ],
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

const QueueFellowshipLogsDungeonRunImportEndpoint = HttpApiEndpoint.post(
  "queueFellowshipLogsDungeonRunImport",
  `${FELLOWSHIP_LOGS_ROUTE}/import-jobs`,
  {
    error: [
      FellowshipLogsApiAlreadyImportedError,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiQueueDungeonRunImportOptionsSchema,
    success: FellowshipLogsApiQueueDungeonRunImportResultSchema.pipe(
      HttpApiSchema.status(202),
    ),
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
  .add(QueueFellowshipLogsDungeonRunImportEndpoint)
  .add(GetFellowshipLogsDungeonRunsEndpoint)
  .add(DeleteFellowshipLogsDungeonRunEndpoint);
