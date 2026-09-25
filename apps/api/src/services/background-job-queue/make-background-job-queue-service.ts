import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Latch from "effect/Latch";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SubscriptionRef from "effect/SubscriptionRef";

import {
  BackgroundJobAttemptsExhaustedError,
  BackgroundJobDeferredError,
  BackgroundJobInvalidPayloadError,
  BackgroundJobUnexpectedError,
} from "@frt/api/errors/background-job-error.ts";
import {
  BackgroundJobQueueError,
  BackgroundJobQueueNotFoundError,
} from "@frt/api/errors/background-job-queue-error.ts";
import { SESSION_STARTED_AT } from "@frt/api/helpers/session-started-at.ts";
import { BackgroundJobPayloadSchema } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import { type BackgroundJobQueueShape } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import {
  BACKGROUND_JOB_QUEUE_BY_KIND,
  BACKGROUND_JOB_QUEUES,
  type BackgroundJobQueueName,
} from "@frt/api/services/background-job-queue/background-job-queues.ts";
import { getBackgroundJobIdempotencyKey } from "@frt/api/services/background-job-queue/get-background-job-idempotency-key.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type BackgroundJobDAOError } from "@frt/db/errors/background-job-dao-error.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { type BackgroundJobFailure } from "@frt/shared/background-job/background-job-failure-schema.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type BackgroundJobStatus } from "@frt/shared/background-job/background-job-status-schema.ts";

type BackgroundJobOperation = BackgroundJobQueueError["operation"];

const QUEUE_NAMES = R.keys(BACKGROUND_JOB_QUEUES);

const CANCELLABLE_STATUSES: ReadonlyArray<BackgroundJobStatus> = [
  "QUEUED",
  "RUNNING",
  "WAITING",
];

const VISIBLE_QUEUE_NAMES = QUEUE_NAMES.filter((queue) => {
  return BACKGROUND_JOB_QUEUES[queue].isVisible;
});

const WORKER_ERROR_DELAY = "1 second";

const MIN_WAITING_JOB_DELAY_MILLISECONDS = 100;

const SETTLE_RETRY_SCHEDULE = Schedule.exponential("100 millis");

const SETTLE_RETRY_TIMES = 3;

function isQueueName(queue: string): queue is BackgroundJobQueueName {
  return Object.hasOwn(BACKGROUND_JOB_QUEUES, queue);
}

function isTaggedError(
  error: unknown,
): error is Error & { readonly _tag: string } {
  return (
    error instanceof Error &&
    Predicate.hasProperty(error, "_tag") &&
    Predicate.isString(error._tag)
  );
}

function toBackgroundJobFailure(error: {
  readonly _tag: string;
  readonly message: string;
}): BackgroundJobFailure {
  return { message: error.message, tag: error._tag };
}

function getFailureFromCause(
  cause: Cause.Cause<unknown>,
): BackgroundJobFailure {
  const error = Option.getOrElse(Cause.findErrorOption(cause), () => {
    return new BackgroundJobUnexpectedError({ cause: Cause.squash(cause) });
  });

  return isTaggedError(error)
    ? toBackgroundJobFailure(error)
    : toBackgroundJobFailure(
        new BackgroundJobUnexpectedError({ cause: error }),
      );
}

function mapCommandError(
  operation: BackgroundJobOperation,
  id: BackgroundJobId,
) {
  return <Success, Requirements>(
    effect: E.Effect<Success, BackgroundJobDAOError, Requirements>,
  ) => {
    return effect.pipe(
      E.catchReason(
        "BackgroundJobDAOError",
        "BackgroundJobNotFoundError",
        () => {
          return E.fail(new BackgroundJobQueueNotFoundError({ id, operation }));
        },
      ),
      E.mapError((cause) => {
        return cause instanceof BackgroundJobQueueNotFoundError
          ? cause
          : new BackgroundJobQueueError({ cause, operation });
      }),
    );
  };
}

export const makeBackgroundJobQueue = E.gen(function* () {
  const backgroundJobDAO = yield* BackgroundJobDAO;
  const backgroundJobRunner = yield* BackgroundJobRunner;

  const sessionId = String(DateTime.toEpochMillis(SESSION_STARTED_AT));
  const revisionRef = yield* SubscriptionRef.make(0);

  const latches = R.map(BACKGROUND_JOB_QUEUES, () => {
    return Latch.makeUnsafe(true);
  });

  const runningFibers = new Map<
    BackgroundJobId,
    Fiber.Fiber<unknown, unknown>
  >();
  const cancelRequests = new Set<BackgroundJobId>();

  const stateLock = yield* Semaphore.make(1);

  const progressById = new Map<BackgroundJobId, number>();

  const bumpRevision = SubscriptionRef.update(revisionRef, (revision) => {
    return revision + 1;
  });

  const wakeQueue = (queue: string) => {
    return isQueueName(queue) ? latches[queue].open : E.void;
  };

  const settle = E.fn("BackgroundJobQueue.settle")(function* ({
    exit,
    job,
  }: {
    readonly exit: Exit.Exit<unknown, unknown>;
    readonly job: BackgroundJobModel;
  }) {
    if (Exit.isSuccess(exit)) {
      return yield* backgroundJobDAO.markSucceeded({
        id: job.id,
        result: Schema.is(Schema.Json)(exit.value) ? exit.value : null,
      });
    }

    if (Cause.hasInterruptsOnly(exit.cause)) {
      if (cancelRequests.has(job.id)) {
        yield* E.logInfo("Cancelled a running background job.");

        return yield* backgroundJobDAO.delete({
          id: job.id,
          statuses: ["RUNNING"],
        });
      }

      return;
    }

    const deferred = Cause.findErrorOption(exit.cause).pipe(
      Option.filter((failure): failure is BackgroundJobDeferredError => {
        return failure instanceof BackgroundJobDeferredError;
      }),
    );

    if (Option.isSome(deferred)) {
      const { availableAt, reason } = deferred.value;

      yield* E.logInfo("Background job is waiting before it can continue.", {
        availableAt: DateTime.formatIso(availableAt),
        reason: reason._tag,
      });

      return yield* backgroundJobDAO.markWaiting({
        availableAt,
        id: job.id,
        reason: toBackgroundJobFailure(reason),
      });
    }

    const error = getFailureFromCause(exit.cause);

    yield* E.logWarning("Background job failed.", { error });

    return yield* backgroundJobDAO.markFailed({ error, id: job.id });
  });

  const releaseJob = (id: BackgroundJobId) => {
    return stateLock.withPermit(
      E.sync(() => {
        runningFibers.delete(id);
        cancelRequests.delete(id);
        progressById.delete(id);
      }),
    );
  };

  const runClaimedJob = E.fn("BackgroundJobQueue.runClaimedJob")(
    function* (claimed: BackgroundJobModel) {
      const decoded = yield* Schema.decodeUnknownEffect(
        BackgroundJobPayloadSchema,
      )(claimed.payload).pipe(E.result);

      if (Result.isFailure(decoded)) {
        return yield* backgroundJobDAO.markFailed({
          error: toBackgroundJobFailure(
            new BackgroundJobInvalidPayloadError({ cause: decoded.failure }),
          ),
          id: claimed.id,
        });
      }

      const reportProgress = (fraction: number) => {
        return E.sync(() => {
          progressById.set(claimed.id, fraction);
        }).pipe(E.andThen(bumpRevision));
      };

      const fiber = yield* stateLock.withPermit(
        E.gen(function* () {
          if (cancelRequests.delete(claimed.id)) {
            return undefined;
          }

          const forked = yield* backgroundJobRunner
            .run(decoded.success, {
              reportProgress,
            })
            .pipe(E.forkChild);

          runningFibers.set(claimed.id, forked);

          return forked;
        }),
      );

      if (fiber === undefined) {
        return yield* backgroundJobDAO.delete({
          id: claimed.id,
          statuses: ["RUNNING"],
        });
      }

      const exit = yield* Fiber.await(fiber);

      yield* settle({ exit, job: claimed }).pipe(
        E.retry({ schedule: SETTLE_RETRY_SCHEDULE, times: SETTLE_RETRY_TIMES }),
      );
    },
    (effect, claimed) => {
      return effect.pipe(E.ensuring(releaseJob(claimed.id)));
    },
  );

  const awaitWork = E.fn("BackgroundJobQueue.awaitWork")(function* (
    queue: BackgroundJobQueueName,
  ) {
    const { holdWhileWaiting } = BACKGROUND_JOB_QUEUES[queue];
    const nextAvailableAt = yield* backgroundJobDAO.getNextAvailableAt({
      holdWhileWaiting,
      queue,
    });

    if (Option.isNone(nextAvailableAt)) {
      return yield* latches[queue].await;
    }

    const nowMilliseconds = yield* Clock.currentTimeMillis;
    const delayMilliseconds = Math.max(
      DateTime.toEpochMillis(nextAvailableAt.value) - nowMilliseconds,
      MIN_WAITING_JOB_DELAY_MILLISECONDS,
    );

    yield* E.raceFirst(
      latches[queue].await,
      E.sleep(Duration.millis(delayMilliseconds)),
    );
  });

  const runWorker = (queue: BackgroundJobQueueName) => {
    const latch = latches[queue];
    const { holdWhileWaiting } = BACKGROUND_JOB_QUEUES[queue];

    return E.gen(function* () {
      yield* latch.close;

      const claimed = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting,
        queue,
      });

      if (Option.isNone(claimed)) {
        return yield* awaitWork(queue);
      }

      yield* bumpRevision;

      yield* runClaimedJob(claimed.value).pipe(
        E.annotateLogs({
          attempts: claimed.value.attempts,
          backgroundJobId: claimed.value.id,
          job: claimed.value.kind,
        }),
      );

      yield* bumpRevision;
    }).pipe(
      E.catchCause((cause) => {
        return Cause.hasInterruptsOnly(cause)
          ? E.failCause(cause)
          : E.logError("Background job worker failed.", { cause }).pipe(
              E.andThen(E.sleep(WORKER_ERROR_DELAY)),
            );
      }),
      E.forever,
      E.annotateLogs({ queue }),
    );
  };

  yield* E.forEach(
    QUEUE_NAMES,
    (queue) => {
      const { maxAttempts } = BACKGROUND_JOB_QUEUES[queue];

      return backgroundJobDAO.recoverRunning({
        exhaustedError: toBackgroundJobFailure(
          new BackgroundJobAttemptsExhaustedError({ maxAttempts }),
        ),
        maxAttempts,
        queue,
      });
    },
    { discard: true },
  ).pipe(
    E.catch((error) => {
      return E.logError("Failed to recover interrupted background jobs.", {
        error,
      });
    }),
  );

  yield* E.forEach(
    QUEUE_NAMES,
    (queue) => {
      return runWorker(queue).pipe(E.forkScoped);
    },
    { discard: true },
  );

  const offer: BackgroundJobQueueShape["offer"] = (job) => {
    return E.gen(function* () {
      const queue = BACKGROUND_JOB_QUEUE_BY_KIND[job._tag];
      const payload = yield* Schema.encodeEffect(BackgroundJobPayloadSchema)(
        job,
      );

      const { job: row, wasInserted } = yield* backgroundJobDAO.insert({
        idempotencyKey: getBackgroundJobIdempotencyKey(job),
        kind: job._tag,
        payload,
        queue,
      });

      if (wasInserted) {
        yield* latches[queue].open;
        yield* bumpRevision;
      }

      return { job: row, wasAlreadyQueued: !wasInserted };
    }).pipe(
      E.mapError((cause) => {
        return new BackgroundJobQueueError({ cause, operation: "Offer" });
      }),
    );
  };

  const cancel: BackgroundJobQueueShape["cancel"] = ({ id }) => {
    return E.gen(function* () {
      const fiberToInterrupt = yield* stateLock.withPermit(
        E.gen(function* () {
          const job = yield* backgroundJobDAO.getById({ id });

          if (
            Option.isNone(job) ||
            !CANCELLABLE_STATUSES.includes(job.value.status)
          ) {
            return yield* new BackgroundJobQueueNotFoundError({
              id,
              operation: "Cancel",
            });
          }

          if (job.value.status !== "RUNNING") {
            const wasDeleted = yield* backgroundJobDAO
              .delete({ id, statuses: ["QUEUED", "WAITING"] })
              .pipe(
                E.as(true),
                E.catchReason(
                  "BackgroundJobDAOError",
                  "BackgroundJobNotFoundError",
                  () => {
                    return E.succeed(false);
                  },
                ),
              );

            if (wasDeleted) {
              yield* bumpRevision;

              return undefined;
            }

            const claimedJob = yield* backgroundJobDAO.getById({ id });

            if (
              Option.isNone(claimedJob) ||
              claimedJob.value.status !== "RUNNING"
            ) {
              return yield* new BackgroundJobQueueNotFoundError({
                id,
                operation: "Cancel",
              });
            }
          }

          cancelRequests.add(id);

          return runningFibers.get(id);
        }),
      );

      if (fiberToInterrupt !== undefined) {
        yield* Fiber.interrupt(fiberToInterrupt);
      }
    }).pipe(
      E.mapError((cause) => {
        return cause instanceof BackgroundJobQueueNotFoundError
          ? cause
          : new BackgroundJobQueueError({ cause, operation: "Cancel" });
      }),
    );
  };

  const dismiss: BackgroundJobQueueShape["dismiss"] = ({ id }) => {
    return backgroundJobDAO
      .delete({ id, statuses: ["FAILED", "SUCCEEDED"] })
      .pipe(E.andThen(bumpRevision), mapCommandError("Dismiss", id));
  };

  const retry: BackgroundJobQueueShape["retry"] = ({ id }) => {
    return backgroundJobDAO.retry({ id }).pipe(
      E.tap((job) => {
        return wakeQueue(job.queue).pipe(E.andThen(bumpRevision));
      }),
      mapCommandError("Retry", id),
    );
  };

  const listVisible: BackgroundJobQueueShape["listVisible"] = () => {
    if (!A.isReadonlyArrayNonEmpty(VISIBLE_QUEUE_NAMES)) {
      return E.succeed([]);
    }

    return backgroundJobDAO.list({ queues: VISIBLE_QUEUE_NAMES }).pipe(
      E.map((jobs) => {
        return jobs.map((job) => {
          return {
            job,
            progress:
              job.status === "RUNNING"
                ? (progressById.get(job.id) ?? null)
                : null,
          };
        });
      }),
      E.mapError((cause) => {
        return new BackgroundJobQueueError({ cause, operation: "List" });
      }),
    );
  };

  return {
    cancel,
    changes: SubscriptionRef.changes(revisionRef),
    dismiss,
    listVisible,
    offer,
    retry,
    revision: SubscriptionRef.get(revisionRef),
    sessionId,
  } satisfies BackgroundJobQueueShape;
});
