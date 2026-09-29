import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import { BackgroundJobApiNotFoundError } from "@frt/api-contract/errors/background-job-api-error.ts";
import { BackgroundJobApiSnapshotSchema } from "@frt/shared/background-job/background-job-api-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

const BACKGROUND_JOBS_ROUTE = "/background-jobs" as const;

const BackgroundJobIdParamsSchema = Schema.Struct({
  jobId: BackgroundJobIdSchema,
});

const BackgroundJobCommandErrors = [
  BackgroundJobApiNotFoundError,
  HttpApiError.InternalServerErrorNoContent,
];

const GetBackgroundJobsEndpoint = HttpApiEndpoint.get(
  "getBackgroundJobs",
  BACKGROUND_JOBS_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: BackgroundJobApiSnapshotSchema,
  },
);

const CancelBackgroundJobEndpoint = HttpApiEndpoint.post(
  "cancelBackgroundJob",
  `${BACKGROUND_JOBS_ROUTE}/:jobId/cancel`,
  {
    error: BackgroundJobCommandErrors,
    params: BackgroundJobIdParamsSchema,
    success: Schema.Void,
  },
);

const RetryBackgroundJobEndpoint = HttpApiEndpoint.post(
  "retryBackgroundJob",
  `${BACKGROUND_JOBS_ROUTE}/:jobId/retry`,
  {
    error: BackgroundJobCommandErrors,
    params: BackgroundJobIdParamsSchema,
    success: Schema.Void,
  },
);

const DismissBackgroundJobEndpoint = HttpApiEndpoint.delete(
  "dismissBackgroundJob",
  `${BACKGROUND_JOBS_ROUTE}/:jobId`,
  {
    error: BackgroundJobCommandErrors,
    params: BackgroundJobIdParamsSchema,
    success: Schema.Void,
  },
);

export const BackgroundJobApi = HttpApiGroup.make("backgroundJob")
  .add(GetBackgroundJobsEndpoint)
  .add(CancelBackgroundJobEndpoint)
  .add(RetryBackgroundJobEndpoint)
  .add(DismissBackgroundJobEndpoint);
