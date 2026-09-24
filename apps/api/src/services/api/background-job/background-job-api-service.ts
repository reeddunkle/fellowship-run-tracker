import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type BackgroundJobError,
  type BackgroundJobNotFoundError,
} from "@frt/api/errors/background-job-error.ts";
import { createBackgroundJobApiItem } from "@frt/api/services/api/background-job/create-background-job-api-response.ts";
import { BackgroundJobService } from "@frt/api/services/background-job/background-job-service.ts";
import { type BackgroundJobApiSnapshot } from "@frt/shared/background-job/background-job-api-schema.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

type BackgroundJobIdOptions = {
  readonly id: BackgroundJobId;
};

type BackgroundJobCommandError =
  | BackgroundJobError
  | BackgroundJobNotFoundError;

export type BackgroundJobApiServiceShape = {
  readonly cancel: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobCommandError>;

  readonly dismiss: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobCommandError>;

  readonly getSnapshot: () => E.Effect<
    BackgroundJobApiSnapshot,
    BackgroundJobError
  >;

  readonly retry: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobCommandError>;
};

const makeBackgroundJobApiService = E.gen(function* () {
  const backgroundJobService = yield* BackgroundJobService;

  const getSnapshot: BackgroundJobApiServiceShape["getSnapshot"] = () => {
    return E.gen(function* () {
      const revision = yield* backgroundJobService.revision;
      const jobs = yield* backgroundJobService.listVisible();

      return {
        jobs: A.getSomes(jobs.map(createBackgroundJobApiItem)),
        revision,
        sessionId: backgroundJobService.sessionId,
      };
    });
  };

  const retry: BackgroundJobApiServiceShape["retry"] = (options) => {
    return backgroundJobService.retry(options).pipe(E.asVoid);
  };

  return {
    cancel: backgroundJobService.cancel,
    dismiss: backgroundJobService.dismiss,
    getSnapshot,
    retry,
  } satisfies BackgroundJobApiServiceShape;
});

/*
 * `BackgroundJobService` runs the queue workers, so it has to be one shared
 * instance provided at the application root rather than erased here.
 */
export class BackgroundJobApiService extends Context.Service<
  BackgroundJobApiService,
  BackgroundJobApiServiceShape
>()(
  "@frt/api/services/api/background-job/background-job-api-service/BackgroundJobApiService",
) {
  static readonly layer = Layer.effect(this, makeBackgroundJobApiService);
}
