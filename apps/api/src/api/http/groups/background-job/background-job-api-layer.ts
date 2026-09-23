import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import {
  type BackgroundJobError,
  type BackgroundJobNotFoundError,
} from "@frt/api/errors/background-job-error.ts";
import { BackgroundJobApiService } from "@frt/api/services/api/background-job/background-job-api-service.ts";
import { BackgroundJobApiNotFoundError } from "@frt/api-contract/errors/background-job-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function logInternalServerError(
  error: BackgroundJobError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Background job API operation failed.", { error });

    return yield* new HttpApiError.InternalServerError();
  });
}

function mapBackgroundJobCommandError(
  error: BackgroundJobError | BackgroundJobNotFoundError,
): E.Effect<
  never,
  BackgroundJobApiNotFoundError | HttpApiError.InternalServerError
> {
  if (error._tag === "BackgroundJobNotFoundError") {
    return E.fail(new BackgroundJobApiNotFoundError({ id: error.id }));
  }

  return logInternalServerError(error);
}

const BackgroundJobApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "backgroundJob",
  E.fn(function* (handlers) {
    const backgroundJobApiService = yield* BackgroundJobApiService;

    return handlers
      .handle("getBackgroundJobs", () => {
        return backgroundJobApiService
          .getSnapshot()
          .pipe(E.catch(logInternalServerError));
      })
      .handle("cancelBackgroundJob", ({ params }) => {
        return backgroundJobApiService
          .cancel({ id: params.jobId })
          .pipe(E.catch(mapBackgroundJobCommandError));
      })
      .handle("retryBackgroundJob", ({ params }) => {
        return backgroundJobApiService
          .retry({ id: params.jobId })
          .pipe(E.catch(mapBackgroundJobCommandError));
      })
      .handle("dismissBackgroundJob", ({ params }) => {
        return backgroundJobApiService
          .dismiss({ id: params.jobId })
          .pipe(E.catch(mapBackgroundJobCommandError));
      });
  }),
);

export const BackgroundJobApiLayer: Layer.Layer<
  Layer.Success<typeof BackgroundJobApiHandlersInferred>,
  Layer.Error<typeof BackgroundJobApiHandlersInferred>,
  BackgroundJobApiService
> = BackgroundJobApiHandlersInferred;
