import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as Schema from "effect/Schema";

import {
  FellowshipLogsApiAlreadyImportedError,
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiDungeonLevelNotFoundError,
  FellowshipLogsApiReportAccessDeniedError,
  FellowshipLogsApiRunNotFinishedError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { FellowshipLogsGatewayApiErrors } from "@frt/api-contract/http/groups/fellowship-logs/fellowship-logs-gateway-api-errors.ts";
import { ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema } from "@frt/shared/background-job/background-job-api-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import {
  FellowshipLogsApiAnalyticsSummarySchema,
  FellowshipLogsApiDungeonRunMetadataSchema,
  FellowshipLogsApiDungeonRunReferenceSchema,
  FellowshipLogsApiImportedDungeonRunListSchema,
  FellowshipLogsApiLastKnownRateLimitDataSchema,
  FellowshipLogsApiQueueDungeonRunImportOptionsSchema,
  FellowshipLogsApiQueueDungeonRunImportResultSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import {
  FellowshipLogsApiImportCostEstimateSchema,
  FellowshipLogsApiPointPoolsSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

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
      FellowshipLogsApiConnectionRequiredError,
      FellowshipLogsApiReportAccessDeniedError,
      FellowshipLogsApiRunNotFoundError,
      FellowshipLogsApiRunNotFinishedError,
      ...FellowshipLogsGatewayApiErrors,
    ],
    payload: FellowshipLogsApiDungeonRunReferenceSchema,
    success: FellowshipLogsApiDungeonRunMetadataSchema,
  },
);

const GetFellowshipLogsRateLimitDataEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsRateLimitData",
  `${FELLOWSHIP_LOGS_ROUTE}/rate-limit-data`,
  {
    error: FellowshipLogsGatewayApiErrors,
    success: FellowshipLogsApiLastKnownRateLimitDataSchema,
  },
);

const GetFellowshipLogsPointPoolsEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsPointPools",
  `${FELLOWSHIP_LOGS_ROUTE}/point-pools`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiPointPoolsSchema,
  },
);

const GetFellowshipLogsImportCostEstimateEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsImportCostEstimate",
  `${FELLOWSHIP_LOGS_ROUTE}/import-cost-estimate`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiImportCostEstimateSchema,
  },
);

const QueueFellowshipLogsDungeonRunImportEndpoint = HttpApiEndpoint.post(
  "queueFellowshipLogsDungeonRunImport",
  `${FELLOWSHIP_LOGS_ROUTE}/import-jobs`,
  {
    error: [
      FellowshipLogsApiAlreadyImportedError,
      FellowshipLogsApiConnectionRequiredError,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiQueueDungeonRunImportOptionsSchema,
    success: FellowshipLogsApiQueueDungeonRunImportResultSchema.pipe(
      HttpApiSchema.status(202),
    ),
  },
);

const ResumeFellowshipLogsImportJobWithCurrentConnectionEndpoint =
  HttpApiEndpoint.post(
    "resumeFellowshipLogsImportJobWithCurrentConnection",
    `${FELLOWSHIP_LOGS_ROUTE}/import-jobs/:jobId/resume-with-current-connection`,
    {
      error: [
        FellowshipLogsApiConnectionRequiredError,
        HttpApiError.NotFoundNoContent,
        HttpApiError.InternalServerErrorNoContent,
      ],
      params: Schema.Struct({ jobId: BackgroundJobIdSchema }),
      success: ImportFellowshipLogsDungeonRunBackgroundJobApiItemSchema,
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

const GetFellowshipLogsAnalyticsEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsAnalytics",
  `${FELLOWSHIP_LOGS_ROUTE}/analytics`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiAnalyticsSummarySchema,
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
  .add(GetFellowshipLogsPointPoolsEndpoint)
  .add(GetFellowshipLogsImportCostEstimateEndpoint)
  .add(QueueFellowshipLogsDungeonRunImportEndpoint)
  .add(ResumeFellowshipLogsImportJobWithCurrentConnectionEndpoint)
  .add(GetFellowshipLogsDungeonRunsEndpoint)
  .add(DeleteFellowshipLogsDungeonRunEndpoint)
  .add(GetFellowshipLogsAnalyticsEndpoint);
