import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import {
  type BackgroundJobQueueError,
  type BackgroundJobQueueNotFoundError,
} from "@frt/api/errors/background-job-queue-error.ts";
import { BackgroundJob } from "@frt/api/services/background-job/background-job-service.ts";
import { BackgroundJobApiNotFoundError } from "@frt/api-contract/errors/background-job-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function logInternalServerError(
  error: BackgroundJobQueueError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Background job API operation failed.", { error });

    return yield* new HttpApiError.InternalServerError();
  });
}

function mapBackgroundJobCommandError(
  error: BackgroundJobQueueError | BackgroundJobQueueNotFoundError,
): E.Effect<
  never,
  BackgroundJobApiNotFoundError | HttpApiError.InternalServerError
> {
  if (error._tag === "BackgroundJobQueueNotFoundError") {
    return E.fail(new BackgroundJobApiNotFoundError({ id: error.id }));
  }

  return logInternalServerError(error);
}

const BackgroundJobApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "backgroundJob",
  E.fn(function* (handlers) {
    const backgroundJob = yield* BackgroundJob;

    return handlers
      .handle("getBackgroundJobs", () => {
        return backgroundJob
          .getSnapshot()
          .pipe(E.catch(logInternalServerError));
      })
      .handle("cancelBackgroundJob", ({ params }) => {
        return backgroundJob
          .cancel({ id: params.jobId })
          .pipe(E.catch(mapBackgroundJobCommandError));
      })
      .handle("retryBackgroundJob", ({ params }) => {
        return backgroundJob
          .retry({ id: params.jobId })
          .pipe(E.catch(mapBackgroundJobCommandError));
      })
      .handle("dismissBackgroundJob", ({ params }) => {
        return backgroundJob
          .dismiss({ id: params.jobId })
          .pipe(E.catch(mapBackgroundJobCommandError));
      });
  }),
);

export const BackgroundJobApiLayer: Layer.Layer<
  Layer.Success<typeof BackgroundJobApiHandlersInferred>,
  Layer.Error<typeof BackgroundJobApiHandlersInferred>,
  BackgroundJob
> = BackgroundJobApiHandlersInferred;
