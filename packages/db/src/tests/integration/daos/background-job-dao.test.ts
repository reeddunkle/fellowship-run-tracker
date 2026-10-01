import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { StateDatabase } from "@frt/db/databases/state-database.ts";
import { BackgroundJobDAOError } from "@frt/db/errors/background-job-dao-error.ts";
import { countFreePages } from "@frt/db/tests/common/count-free-pages.ts";
import { getSome } from "@frt/db/tests/common/get-some.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

const QUEUE = "test-queue";

const EXHAUSTED_ERROR = {
  message: "Gave up.",
  tag: "Exhausted",
};

const insertJob = E.fn("test.insert-background-job")(function* (options?: {
  readonly idempotencyKey?: string | null;
  readonly queue?: string;
}) {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  return yield* backgroundJobDAO.insert({
    idempotencyKey: options?.idempotencyKey ?? null,
    kind: "TestJob",
    payload: { value: 1 },
    queue: options?.queue ?? QUEUE,
    traceparent: null,
  });
});

describe("BackgroundJobDAO", () => {
  test("inserts a queued job", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const { job, wasInserted } = yield* insertJob({ idempotencyKey: "a" });

      expect(wasInserted).toBe(true);
      expect(job.status).toBe("QUEUED");
      expect(job.attempts).toBe(0);
      expect(job.payload).toEqual({ value: 1 });
      expect(job.error).toBeNull();

      const found = yield* backgroundJobDAO.getById({ id: job.id });

      expect(getSome(found)).toEqual(job);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns the active job for a duplicate idempotency key", async () => {
    const program = E.gen(function* () {
      const first = yield* insertJob({ idempotencyKey: "a" });
      const second = yield* insertJob({ idempotencyKey: "a" });
      const otherQueue = yield* insertJob({
        idempotencyKey: "a",
        queue: "other-queue",
      });

      expect(second.wasInserted).toBe(false);
      expect(second.job.id).toBe(first.job.id);
      expect(otherQueue.wasInserted).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("allows a new job once the previous one with the same key finished", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const first = yield* insertJob({ idempotencyKey: "a" });

      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.markSucceeded({ id: first.job.id, result: null });

      const second = yield* insertJob({ idempotencyKey: "a" });

      expect(second.wasInserted).toBe(true);
      expect(second.job.id).not.toBe(first.job.id);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("claims queued jobs oldest first", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const first = yield* insertJob();
      const second = yield* insertJob();

      const claimedFirst = getSome(
        yield* backgroundJobDAO.claimNext({
          holdWhileWaiting: false,
          queue: QUEUE,
        }),
      );
      const claimedSecond = getSome(
        yield* backgroundJobDAO.claimNext({
          holdWhileWaiting: false,
          queue: QUEUE,
        }),
      );
      const claimedNone = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      expect(claimedFirst.id).toBe(first.job.id);
      expect(claimedFirst.status).toBe("RUNNING");
      expect(claimedFirst.attempts).toBe(1);
      expect(claimedFirst.startedAt).not.toBeNull();
      expect(claimedSecond.id).toBe(second.job.id);
      expect(Option.isNone(claimedNone)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("records success and failure", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const succeeded = yield* insertJob();
      const failed = yield* insertJob();

      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      yield* backgroundJobDAO.markSucceeded({
        id: succeeded.job.id,
        result: { dungeonRunId: "run" },
      });

      yield* backgroundJobDAO.markFailed({
        error: { message: "Boom.", tag: "Boom" },
        id: failed.job.id,
      });

      const [succeededJob, failedJob] = yield* backgroundJobDAO.list({
        queues: [QUEUE],
      });

      expect(succeededJob?.status).toBe("SUCCEEDED");
      expect(succeededJob?.result).toEqual({ dungeonRunId: "run" });
      expect(succeededJob?.finishedAt).not.toBeNull();
      expect(failedJob?.status).toBe("FAILED");
      expect(failedJob?.error).toEqual({ message: "Boom.", tag: "Boom" });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("retries a failed job unless an equivalent job is active", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const { job } = yield* insertJob({ idempotencyKey: "a" });

      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.markFailed({
        error: { message: "Boom.", tag: "Boom" },
        id: job.id,
      });

      const duplicate = yield* insertJob({ idempotencyKey: "a" });
      const blockedRetry = yield* backgroundJobDAO
        .retry({ id: job.id })
        .pipe(E.flip);

      expect(blockedRetry).toBeInstanceOf(BackgroundJobDAOError);
      expect(blockedRetry.reason._tag).toBe("BackgroundJobNotFoundError");

      yield* backgroundJobDAO.delete({
        id: duplicate.job.id,
        statuses: ["QUEUED"],
      });

      const retried = yield* backgroundJobDAO.retry({ id: job.id });

      expect(retried.status).toBe("QUEUED");
      expect(retried.attempts).toBe(0);
      expect(retried.error).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("only deletes jobs with a matching status", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const { job } = yield* insertJob();

      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      const error = yield* backgroundJobDAO
        .delete({ id: job.id, statuses: ["QUEUED"] })
        .pipe(E.flip);

      expect(error.reason._tag).toBe("BackgroundJobNotFoundError");

      yield* backgroundJobDAO.delete({ id: job.id, statuses: ["RUNNING"] });

      const found = yield* backgroundJobDAO.getById({ id: job.id });

      expect(Option.isNone(found)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("recovers running jobs and fails exhausted ones", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const exhausted = yield* insertJob();
      const recoverable = yield* insertJob();

      // Two claims of the first job use up its attempts.
      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.recoverRunning({
        exhaustedError: EXHAUSTED_ERROR,
        maxAttempts: 2,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      yield* backgroundJobDAO.recoverRunning({
        exhaustedError: EXHAUSTED_ERROR,
        maxAttempts: 2,
        queue: QUEUE,
      });

      const exhaustedJob = getSome(
        yield* backgroundJobDAO.getById({ id: exhausted.job.id }),
      );
      const recoverableJob = getSome(
        yield* backgroundJobDAO.getById({ id: recoverable.job.id }),
      );

      expect(exhaustedJob.status).toBe("FAILED");
      expect(exhaustedJob.error).toEqual(EXHAUSTED_ERROR);
      expect(recoverableJob.status).toBe("QUEUED");
      expect(recoverableJob.attempts).toBe(1);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("only deletes finished jobs in the given queues", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const hidden = yield* insertJob({ queue: "hidden-queue" });
      const visible = yield* insertJob({ queue: "visible-queue" });

      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: "hidden-queue",
      });
      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: "visible-queue",
      });
      yield* backgroundJobDAO.markFailed({
        error: { message: "Boom.", tag: "Boom" },
        id: hidden.job.id,
      });
      yield* backgroundJobDAO.markFailed({
        error: { message: "Boom.", tag: "Boom" },
        id: visible.job.id,
      });

      const deletedCount = yield* backgroundJobDAO.deleteFinishedBefore({
        finishedBefore: DateTime.add(yield* DateTime.now, { minutes: 1 }),
        queues: ["hidden-queue"],
        statuses: ["FAILED"],
      });

      const hiddenJob = yield* backgroundJobDAO.getById({ id: hidden.job.id });
      const visibleJob = yield* backgroundJobDAO.getById({
        id: visible.job.id,
      });

      expect(deletedCount).toBe(1);
      expect(Option.isNone(hiddenJob)).toBe(true);
      expect(Option.isSome(visibleJob)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes finished jobs before a cutoff and keeps those finished at or after it", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const succeeded = yield* insertJob();
      const queued = yield* insertJob();

      yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      yield* backgroundJobDAO.markSucceeded({
        id: succeeded.job.id,
        result: null,
      });

      const finished = getSome(
        yield* backgroundJobDAO.getById({ id: succeeded.job.id }),
      );
      const finishedAt = getSome(Option.fromNullOr(finished.finishedAt));

      const deletedAtCutoffCount = yield* backgroundJobDAO.deleteFinishedBefore(
        {
          finishedBefore: finishedAt,
          statuses: ["SUCCEEDED"],
        },
      );

      const remainingAtCutoff = yield* backgroundJobDAO.list({
        queues: [QUEUE],
      });

      const deletedAfterCutoffCount =
        yield* backgroundJobDAO.deleteFinishedBefore({
          finishedBefore: DateTime.add(finishedAt, { milliseconds: 1 }),
          statuses: ["SUCCEEDED"],
        });

      const remainingAfterCutoff = yield* backgroundJobDAO.list({
        queues: [QUEUE],
      });

      expect(deletedAtCutoffCount).toBe(0);
      expect(remainingAtCutoff.map((job) => job.id)).toEqual(
        expect.arrayContaining([succeeded.job.id, queued.job.id]),
      );
      expect(deletedAfterCutoffCount).toBe(1);
      expect(remainingAfterCutoff.map((job) => job.id)).toEqual([
        queued.job.id,
      ]);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
  test("incrementalVacuum gives back every page freed by removed jobs", async () => {
    const { freePagesAfterDelete, freePagesAfterVacuum } = await E.gen(
      function* () {
        const backgroundJobDAO = yield* BackgroundJobDAO;
        const sql = yield* StateDatabase;

        const { job } = yield* backgroundJobDAO.insert({
          idempotencyKey: null,
          kind: "TestJob",
          payload: { value: "x".repeat(100_000) },
          queue: QUEUE,
          traceparent: null,
        });

        yield* backgroundJobDAO.delete({ id: job.id, statuses: ["QUEUED"] });

        const afterDelete = yield* countFreePages(sql);

        yield* backgroundJobDAO.incrementalVacuum();

        return {
          freePagesAfterDelete: afterDelete,
          freePagesAfterVacuum: yield* countFreePages(sql),
        };
      },
    ).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(freePagesAfterDelete).toBeGreaterThan(1);
    expect(freePagesAfterVacuum).toBe(0);
  });
});
