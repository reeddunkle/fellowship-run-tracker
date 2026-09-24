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
import { type BackgroundJobFailure } from "@frt/shared/background-job/background-job-failure-schema.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type BackgroundJobStatus } from "@frt/shared/background-job/background-job-status-schema.ts";

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
  readonly holdWhileWaiting: boolean;
  readonly queue: string;
};

type GetNextAvailableAtOptions = ClaimNextBackgroundJobOptions;

type MarkBackgroundJobWaitingOptions = {
  readonly availableAt: DateTime.Utc;
  readonly id: BackgroundJobId;
  readonly reason: BackgroundJobFailure;
};

type DeleteBackgroundJobOptions = {
  readonly id: BackgroundJobId;
  readonly statuses: A.NonEmptyReadonlyArray<BackgroundJobStatus>;
};

type DeleteFinishedBackgroundJobsOptions = {
  readonly finishedBefore: DateTime.Utc;
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
  readonly claimNext: (
    options: ClaimNextBackgroundJobOptions,
  ) => E.Effect<Option.Option<BackgroundJobModel>, BackgroundJobDAOError>;

  readonly delete: (
    options: DeleteBackgroundJobOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  readonly deleteFinishedBefore: (
    options: DeleteFinishedBackgroundJobsOptions,
  ) => E.Effect<number, BackgroundJobDAOError>;

  readonly getById: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<Option.Option<BackgroundJobModel>, BackgroundJobDAOError>;

  readonly getNextAvailableAt: (
    options: GetNextAvailableAtOptions,
  ) => E.Effect<Option.Option<DateTime.Utc>, BackgroundJobDAOError>;

  readonly incrementalVacuum: () => E.Effect<void, BackgroundJobDAOError>;

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

  readonly markWaiting: (
    options: MarkBackgroundJobWaitingOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

  readonly recoverRunning: (
    options: RecoverRunningBackgroundJobsOptions,
  ) => E.Effect<void, BackgroundJobDAOError>;

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
