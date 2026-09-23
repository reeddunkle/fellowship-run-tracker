import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
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
  BackgroundJobError,
  BackgroundJobInvalidPayloadError,
  BackgroundJobNotFoundError,
  BackgroundJobUnexpectedError,
} from "@frt/api/errors/background-job-error.ts";
import { SESSION_STARTED_AT } from "@frt/api/helpers/session-started-at.ts";
import {
  BACKGROUND_JOB_QUEUE_BY_KIND,
  BACKGROUND_JOB_QUEUES,
  type BackgroundJobQueueName,
} from "@frt/api/services/background-job/background-job-queues.ts";
import { BackgroundJobSchema } from "@frt/api/services/background-job/background-job-schema.ts";
import { type BackgroundJobServiceShape } from "@frt/api/services/background-job/background-job-service.ts";
import { getBackgroundJobIdempotencyKey } from "@frt/api/services/background-job/get-background-job-idempotency-key.ts";
import { runBackgroundJob } from "@frt/api/services/background-job/run-background-job.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type BackgroundJobDAOError } from "@frt/db/errors/background-job-dao-error.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { type BackgroundJobFailure } from "@frt/shared/validation/background-job/background-job-failure-schema.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

type BackgroundJobOperation = BackgroundJobError["operation"];

const QUEUE_NAMES = R.keys(BACKGROUND_JOB_QUEUES);

const VISIBLE_QUEUE_NAMES = QUEUE_NAMES.filter((queue) => {
  return BACKGROUND_JOB_QUEUES[queue].isVisible;
});

// Keeps a worker from spinning if the database keeps failing.
const WORKER_ERROR_DELAY = "1 second";

// Recording a job's outcome is retried briefly, so a transient database error
// doesn't leave the job stuck as RUNNING for the rest of the session.
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
          return E.fail(new BackgroundJobNotFoundError({ id, operation }));
        },
      ),
      E.mapError((cause) => {
        return cause instanceof BackgroundJobNotFoundError
          ? cause
          : new BackgroundJobError({ cause, operation });
      }),
    );
  };
}

export const makeBackgroundJobService = E.gen(function* () {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  const sessionId = String(DateTime.toEpochMillis(SESSION_STARTED_AT));
  const revisionRef = yield* SubscriptionRef.make(0);

  // Each worker waits on its queue's latch while the queue is empty. Anything
  // that queues a job opens the latch.
  const latches = R.map(BACKGROUND_JOB_QUEUES, () => {
    return Latch.makeUnsafe(true);
  });

  const runningFibers = new Map<
    BackgroundJobId,
    Fiber.Fiber<unknown, unknown>
  >();
  const cancelRequests = new Set<BackgroundJobId>();

  // Serializes changes to `runningFibers` and `cancelRequests` between the
  // workers and `cancel`, so a cancel is never lost or left behind to act on
  // a later retry of the same job.
  const stateLock = yield* Semaphore.make(1);

  // Progress of running jobs, from 0 to 1. Kept in memory only: after a
  // restart a resumed job starts again from the beginning anyway.
  const progressById = new Map<BackgroundJobId, number>();

  const bumpRevision = SubscriptionRef.update(revisionRef, (revision) => {
    return revision + 1;
  });

  const wakeQueue = (queue: string) => {
    return isQueueName(queue) ? latches[queue].open : E.void;
  };

  const settle = E.fn("BackgroundJobService.settle")(function* ({
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
      // `cancel` records its request before interrupting, and the request is
      // only cleared once the job is released after settling.
      if (cancelRequests.has(job.id)) {
        yield* E.logInfo("Cancelled a running background job.");

        return yield* backgroundJobDAO.delete({
          id: job.id,
          statuses: ["RUNNING"],
        });
      }

      // Only reachable during shutdown. The job stays RUNNING so the next
      // session's recovery queues it again.
      return;
    }

    const error = getFailureFromCause(exit.cause);

    yield* E.logWarning("Background job failed.", { error });

    return yield* backgroundJobDAO.markFailed({ error, id: job.id });
  });

  // Forgets a job's in-memory state once its outcome is recorded. Until then
  // it stays in `runningFibers`, so a racing `cancel` can't mistake a job
  // that's finishing for one that hasn't started.
  const releaseJob = (id: BackgroundJobId) => {
    return stateLock.withPermit(
      E.sync(() => {
        runningFibers.delete(id);
        cancelRequests.delete(id);
        progressById.delete(id);
      }),
    );
  };

  const runClaimedJob = E.fn("BackgroundJobService.runClaimedJob")(function* (
    claimed: BackgroundJobModel,
  ) {
    const decoded = yield* Schema.decodeUnknownEffect(BackgroundJobSchema)(
      claimed.payload,
    ).pipe(E.result);

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

    // Forked as a child so shutting down the worker also stops the job, and so
    // `cancel` can interrupt just this job. Checking for a cancel and
    // registering the fiber happen together under the lock.
    const fiber = yield* stateLock.withPermit(
      E.gen(function* () {
        if (cancelRequests.delete(claimed.id)) {
          return undefined;
        }

        const forked = yield* runBackgroundJob(decoded.success, {
          reportProgress,
        }).pipe(E.forkChild);

        runningFibers.set(claimed.id, forked);

        return forked;
      }),
    );

    // Cancelled between being claimed and starting.
    if (fiber === undefined) {
      return yield* backgroundJobDAO.delete({
        id: claimed.id,
        statuses: ["RUNNING"],
      });
    }

    const exit = yield* Fiber.await(fiber);

    yield* settle({ exit, job: claimed }).pipe(
      E.retry({ schedule: SETTLE_RETRY_SCHEDULE, times: SETTLE_RETRY_TIMES }),
      E.ensuring(releaseJob(claimed.id)),
    );
  });

  const runWorker = (queue: BackgroundJobQueueName) => {
    const latch = latches[queue];

    return E.gen(function* () {
      // Close before claiming, so an offer that lands after an empty claim
      // reopens the latch rather than being missed.
      yield* latch.close;

      const claimed = yield* backgroundJobDAO.claimNext({ queue });

      if (Option.isNone(claimed)) {
        return yield* latch.await;
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
      // Catch defects too: one unexpected failure mustn't stop the queue for
      // the rest of the session. Interruption (shutdown) still ends the loop.
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

  // Jobs still RUNNING were cut off when the app last closed. Queue them again
  // before the workers start.
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

  const offer: BackgroundJobServiceShape["offer"] = (job) => {
    return E.gen(function* () {
      const queue = BACKGROUND_JOB_QUEUE_BY_KIND[job._tag];
      const payload = yield* Schema.encodeEffect(BackgroundJobSchema)(job);

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
        return new BackgroundJobError({ cause, operation: "Offer" });
      }),
    );
  };

  const cancel: BackgroundJobServiceShape["cancel"] = ({ id }) => {
    return E.gen(function* () {
      const fiberToInterrupt = yield* stateLock.withPermit(
        E.gen(function* () {
          // Read under the lock: a finishing job keeps its fiber registered
          // until its outcome is recorded, so a RUNNING row with no fiber is
          // a job that hasn't started yet.
          const job = yield* backgroundJobDAO.getById({ id });

          if (
            Option.isNone(job) ||
            (job.value.status !== "QUEUED" && job.value.status !== "RUNNING")
          ) {
            return yield* new BackgroundJobNotFoundError({
              id,
              operation: "Cancel",
            });
          }

          if (job.value.status === "QUEUED") {
            const wasDeleted = yield* backgroundJobDAO
              .delete({ id, statuses: ["QUEUED"] })
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

            // A worker claimed it in the meantime. It can't start while the
            // lock is held, so it sees the request below before running.
          }

          cancelRequests.add(id);

          return runningFibers.get(id);
        }),
      );

      // Interrupt outside the lock: the job's worker takes the lock to
      // release the job once it has settled.
      if (fiberToInterrupt !== undefined) {
        yield* Fiber.interrupt(fiberToInterrupt);
      }
    }).pipe(
      E.mapError((cause) => {
        return cause instanceof BackgroundJobNotFoundError
          ? cause
          : new BackgroundJobError({ cause, operation: "Cancel" });
      }),
    );
  };

  const dismiss: BackgroundJobServiceShape["dismiss"] = ({ id }) => {
    return backgroundJobDAO
      .delete({ id, statuses: ["FAILED", "SUCCEEDED"] })
      .pipe(E.andThen(bumpRevision), mapCommandError("Dismiss", id));
  };

  const retry: BackgroundJobServiceShape["retry"] = ({ id }) => {
    return backgroundJobDAO.retry({ id }).pipe(
      E.tap((job) => {
        return wakeQueue(job.queue).pipe(E.andThen(bumpRevision));
      }),
      mapCommandError("Retry", id),
    );
  };

  const listVisible: BackgroundJobServiceShape["listVisible"] = () => {
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
        return new BackgroundJobError({ cause, operation: "List" });
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
  } satisfies BackgroundJobServiceShape;
});
