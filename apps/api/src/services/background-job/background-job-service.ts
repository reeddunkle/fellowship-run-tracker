import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Stream from "effect/Stream";

import {
  type BackgroundJobQueueError,
  type BackgroundJobQueueNotFoundError,
} from "@frt/api/errors/background-job-queue-error.ts";
import { createBackgroundJobApiItem } from "@frt/api/services/background-job/create-background-job-api-response.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { type BackgroundJobApiSnapshot } from "@frt/shared/background-job/background-job-api-schema.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";

type BackgroundJobIdOptions = {
  readonly id: BackgroundJobId;
};

type BackgroundJobQueueCommandError =
  | BackgroundJobQueueError
  | BackgroundJobQueueNotFoundError;

export type BackgroundJobShape = {
  readonly cancel: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobQueueCommandError>;

  readonly changes: Stream.Stream<number>;

  readonly dismiss: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobQueueCommandError>;

  readonly getSnapshot: () => E.Effect<
    BackgroundJobApiSnapshot,
    BackgroundJobQueueError
  >;

  readonly retry: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobQueueCommandError>;
};

const makeBackgroundJob = E.gen(function* () {
  const backgroundJobQueue = yield* BackgroundJobQueue;

  const getSnapshot: BackgroundJobShape["getSnapshot"] = () => {
    return E.gen(function* () {
      const revision = yield* backgroundJobQueue.revision;
      const jobs = yield* backgroundJobQueue.listVisible();

      return {
        jobs: A.getSomes(jobs.map(createBackgroundJobApiItem)),
        revision,
        sessionId: backgroundJobQueue.sessionId,
      };
    });
  };

  const retry: BackgroundJobShape["retry"] = (options) => {
    return backgroundJobQueue.retry(options).pipe(E.asVoid);
  };

  return {
    cancel: backgroundJobQueue.cancel,
    changes: backgroundJobQueue.changes,
    dismiss: backgroundJobQueue.dismiss,
    getSnapshot,
    retry,
  } satisfies BackgroundJobShape;
});

export class BackgroundJob extends Context.Service<
  BackgroundJob,
  BackgroundJobShape
>()("@frt/api/services/background-job/background-job-service/BackgroundJob") {
  static readonly layer = Layer.effect(this, makeBackgroundJob);
}
