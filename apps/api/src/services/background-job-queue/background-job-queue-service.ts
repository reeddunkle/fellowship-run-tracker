import type * as A from "effect/Array";
import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Stream from "effect/Stream";

import {
  type BackgroundJobQueueError,
  type BackgroundJobQueueNotFoundError,
} from "@frt/api/errors/background-job-queue-error.ts";
import { type BackgroundJobPayload } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import { type BackgroundJobQueueName } from "@frt/api/services/background-job-queue/background-job-queues.ts";
import { makeBackgroundJobQueue } from "@frt/api/services/background-job-queue/make-background-job-queue-service.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type BackgroundJobWaitingReason } from "@frt/shared/background-job/background-job-waiting-reason-schema.ts";

export type VisibleBackgroundJob = {
  readonly job: BackgroundJobModel;
  readonly progress: number | null;
};

type OfferBackgroundJobOptions = {
  readonly bindingKey: string;
};

type OfferBackgroundJobResult = {
  readonly job: BackgroundJobModel;
  readonly wasAlreadyQueued: boolean;
};

type BackgroundJobIdOptions = {
  readonly id: BackgroundJobId;
};

type HoldWaitingBackgroundJobsOptions = {
  readonly fromWaitingReasons: A.NonEmptyReadonlyArray<BackgroundJobWaitingReason>;
  readonly queue: BackgroundJobQueueName;
  readonly toWaitingReason: BackgroundJobWaitingReason;
  readonly unlessBindingKey: string | null;
};

type ResumeWaitingBackgroundJobOptions = {
  readonly bindingKey: string;
  readonly id: BackgroundJobId;
  readonly waitingReasons: A.NonEmptyReadonlyArray<BackgroundJobWaitingReason>;
};

type ResumeWaitingBackgroundJobsOptions = {
  readonly bindingKey?: string;
  readonly queue: BackgroundJobQueueName;
  readonly waitingReasons: A.NonEmptyReadonlyArray<BackgroundJobWaitingReason>;
};

type BackgroundJobQueueCommandError =
  | BackgroundJobQueueError
  | BackgroundJobQueueNotFoundError;

export type BackgroundJobQueueShape = {
  readonly cancel: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobQueueCommandError>;

  readonly changes: Stream.Stream<number>;

  readonly dismiss: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobQueueCommandError>;

  readonly holdWaiting: (
    options: HoldWaitingBackgroundJobsOptions,
  ) => E.Effect<number, BackgroundJobQueueError>;

  readonly listVisible: () => E.Effect<
    ReadonlyArray<VisibleBackgroundJob>,
    BackgroundJobQueueError
  >;

  readonly offer: (
    job: BackgroundJobPayload,
    options?: OfferBackgroundJobOptions,
  ) => E.Effect<OfferBackgroundJobResult, BackgroundJobQueueError>;

  readonly resumeWaitingJob: (
    options: ResumeWaitingBackgroundJobOptions,
  ) => E.Effect<BackgroundJobModel, BackgroundJobQueueCommandError>;

  readonly resumeWaiting: (
    options: ResumeWaitingBackgroundJobsOptions,
  ) => E.Effect<number, BackgroundJobQueueError>;

  readonly retry: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<BackgroundJobModel, BackgroundJobQueueCommandError>;

  readonly revision: E.Effect<number>;

  readonly sessionId: string;
};

export class BackgroundJobQueue extends Context.Service<
  BackgroundJobQueue,
  BackgroundJobQueueShape
>()(
  "@frt/api/services/background-job-queue/background-job-queue-service/BackgroundJobQueue",
) {
  static readonly layerNoDeps = Layer.effect(this, makeBackgroundJobQueue);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(BackgroundJobDAO.layer),
    Layer.provide(BackgroundJobRunner.layer),
  );
}
