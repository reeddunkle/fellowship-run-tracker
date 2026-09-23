import type * as A from "effect/Array";
import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import { makeBackgroundJobDAO } from "@frt/db/daos/background-job/make-background-job-dao.ts";
import { type BackgroundJobDAOError } from "@frt/db/errors/background-job-dao-error.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { type BackgroundJobFailure } from "@frt/shared/validation/background-job/background-job-failure-schema.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { type BackgroundJobStatus } from "@frt/shared/validation/background-job/background-job-status-schema.ts";

type InsertBackgroundJobOptions = {
  readonly idempotencyKey: string | null;
  readonly kind: string;
  readonly payload: Schema.Json;
  readonly queue: string;
};

type InsertBackgroundJobResult = {
  readonly job: BackgroundJobModel;
  readonly wasInserted: boolean;
};

type BackgroundJobIdOptions = {
  readonly id: BackgroundJobId;
};

type ClaimNextBackgroundJobOptions = {
  /**
   * Claim nothing while any job in the queue is `WAITING` for a time still
   * in the future, so the whole queue waits along with it.
   */
  readonly holdWhileWaiting: boolean;
  readonly queue: string;
};

type GetNextAvailableAtOptions = ClaimNextBackgroundJobOptions;

type MarkBackgroundJobWaitingOptions = {
  readonly availableAt: DateTime.Utc;
  readonly id: BackgroundJobId;
  /** Why the job is waiting; stored in its `error` column. */
  readonly reason: BackgroundJobFailure;
};

type DeleteBackgroundJobOptions = {
  readonly id: BackgroundJobId;
  readonly statuses: A.NonEmptyReadonlyArray<BackgroundJobStatus>;
};

type DeleteFinishedBackgroundJobsOptions = {
  readonly finishedBefore: DateTime.Utc;
  /** Only delete jobs in these queues. Defaults to every queue. */
  readonly queues?: A.NonEmptyReadonlyArray<string>;
  readonly statuses: A.NonEmptyReadonlyArray<BackgroundJobStatus>;
};

type ListBackgroundJobsOptions = {
  readonly queues: A.NonEmptyReadonlyArray<string>;
};

type MarkBackgroundJobFailedOptions = {
  readonly error: BackgroundJobFailure;
  readonly id: BackgroundJobId;
};

type MarkBackgroundJobSucceededOptions = {
  readonly id: BackgroundJobId;
  readonly result: Schema.Json;
};

type RecoverRunningBackgroundJobsOptions = {
  readonly exhaustedError: BackgroundJobFailure;
  readonly maxAttempts: number;
  readonly queue: string;
};

export type BackgroundJobDAOShape = {
  /**
   * Atomically moves the next job in `queue` to `RUNNING` and increments its
   * attempts. Waiting jobs whose time has come are claimed before queued
   * ones; otherwise the oldest queued job is claimed.
   */
  readonly claimNext: (
    options: ClaimNextBackgroundJobOptions,
  ) => E.Effect<Option.Option<BackgroundJobModel>, BackgroundJobDAOError>;

  /**
   * Deletes a job only while it has one of `statuses`, so a queued job that
   * was claimed in the meantime is not deleted out from under its worker.
   */
  readonly delete: (
    options: DeleteBackgroundJobOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  readonly deleteFinishedBefore: (
    options: DeleteFinishedBackgroundJobsOptions,
  ) => E.Effect<number, BackgroundJobDAOError>;

  readonly getById: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<Option.Option<BackgroundJobModel>, BackgroundJobDAOError>;

  /**
   * When `queue` can next make progress on its `WAITING` jobs: the earliest
   * one's time, or the latest one's when the queue holds while any wait.
   */
  readonly getNextAvailableAt: (
    options: GetNextAvailableAtOptions,
  ) => E.Effect<Option.Option<DateTime.Utc>, BackgroundJobDAOError>;

  /**
   * Inserts a queued job. When an active (queued, waiting or running) job
   * with the same queue and idempotency key already exists, returns it
   * instead.
   */
  readonly insert: (
    options: InsertBackgroundJobOptions,
  ) => E.Effect<InsertBackgroundJobResult, BackgroundJobDAOError>;

  readonly list: (
    options: ListBackgroundJobsOptions,
  ) => E.Effect<ReadonlyArray<BackgroundJobModel>, BackgroundJobDAOError>;

  readonly markFailed: (
    options: MarkBackgroundJobFailedOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  readonly markSucceeded: (
    options: MarkBackgroundJobSucceededOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  /**
   * Parks a running job as `WAITING` until `availableAt`, giving back the
   * attempt it used.
   */
  readonly markWaiting: (
    options: MarkBackgroundJobWaitingOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  /**
   * Returns jobs left `RUNNING` by a previous session to `QUEUED`, or marks
   * them `FAILED` once they have used `maxAttempts`, so a job that crashes the
   * app cannot loop forever.
   */
  readonly recoverRunning: (
    options: RecoverRunningBackgroundJobsOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  /**
   * Moves a failed job back to `QUEUED` with its attempts reset. Fails with
   * `BackgroundJobNotFoundError` when the job is not failed, or when another
   * active job with the same idempotency key already exists.
   */
  readonly retry: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<BackgroundJobModel, BackgroundJobDAOError>;
};

export class BackgroundJobDAO extends Context.Service<
  BackgroundJobDAO,
  BackgroundJobDAOShape
>()("@frt/db/daos/background-job/background-job-dao/BackgroundJobDAO") {
  static readonly layer = Layer.effect(this, makeBackgroundJobDAO);
}
