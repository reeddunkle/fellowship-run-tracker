import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

const QUEUE = "test-queue";

const WAITING_REASON = {
  message: "Out of points.",
  tag: "RateLimited",
};

const EXHAUSTED_ERROR = {
  message: "Gave up.",
  tag: "Exhausted",
};

const insertJob = E.fn("test.insert-background-job")(function* (options?: {
  readonly idempotencyKey?: string | null;
}) {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  return yield* backgroundJobDAO.insert({
    idempotencyKey: options?.idempotencyKey ?? null,
    kind: "TestJob",
    payload: { value: 1 },
    queue: QUEUE,
  });
});

/** Claims the next job and parks it until `availableAt`. */
const claimAndPark = E.fn("test.claim-and-park-background-job")(function* (
  availableAt: DateTime.Utc,
) {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  const claimed = yield* backgroundJobDAO.claimNext({
    holdWhileWaiting: false,
    queue: QUEUE,
  });

  const job = getSome(claimed);

  yield* backgroundJobDAO.markWaiting({
    availableAt,
    id: job.id,
    reason: WAITING_REASON,
  });

  return job;
});

function getSome<T>(option: Option.Option<T>): T {
  if (Option.isNone(option)) {
    throw new Error("Expected a value.");
  }

  return option.value;
}

function fromNow(minutes: number) {
  return DateTime.add(DateTime.nowUnsafe(), { minutes });
}

// Millisecond precision, like the stored value.
function toStored(dateTime: DateTime.Utc) {
  return dateTime.pipe(DateTime.toEpochMillis, DateTime.makeUnsafe);
}

describe("BackgroundJobDAO waiting jobs", () => {
  test("parks a running job with its reason, handing back the attempt", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();

      const availableAt = fromNow(10);
      const claimed = yield* claimAndPark(availableAt);

      const job = getSome(yield* backgroundJobDAO.getById({ id: claimed.id }));

      expect(claimed.attempts).toBe(1);
      expect(job.status).toBe("WAITING");
      expect(job.attempts).toBe(0);
      expect(job.availableAt).toEqual(toStored(availableAt));
      expect(job.error).toEqual(WAITING_REASON);
      expect(job.startedAt).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("only parks running jobs", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const { job } = yield* insertJob();

      const error = yield* backgroundJobDAO
        .markWaiting({
          availableAt: fromNow(10),
          id: job.id,
          reason: WAITING_REASON,
        })
        .pipe(E.flip);

      expect(error.reason._tag).toBe("BackgroundJobNotFoundError");
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("skips a waiting job until its time, but claims other jobs", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      const queued = yield* insertJob();

      yield* claimAndPark(fromNow(10));

      const claimed = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      expect(getSome(claimed).id).toBe(queued.job.id);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("holds the whole queue while a job waits, when asked to", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      yield* insertJob();

      yield* claimAndPark(fromNow(10));

      const claimed = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: true,
        queue: QUEUE,
      });

      expect(Option.isNone(claimed)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("claims a waiting job first once it's due, clearing the wait", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      yield* insertJob();

      const parked = yield* claimAndPark(fromNow(-1));

      const claimed = getSome(
        yield* backgroundJobDAO.claimNext({
          holdWhileWaiting: true,
          queue: QUEUE,
        }),
      );

      expect(claimed.id).toBe(parked.id);
      expect(claimed.status).toBe("RUNNING");
      expect(claimed.attempts).toBe(1);
      expect(claimed.availableAt).toBeNull();
      expect(claimed.error).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("reports when the queue can next make progress", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const none = yield* backgroundJobDAO.getNextAvailableAt({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      yield* insertJob();
      yield* insertJob();

      const later = fromNow(20);
      const sooner = fromNow(10);

      yield* claimAndPark(later);
      yield* claimAndPark(sooner);

      const earliest = yield* backgroundJobDAO.getNextAvailableAt({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      const latest = yield* backgroundJobDAO.getNextAvailableAt({
        holdWhileWaiting: true,
        queue: QUEUE,
      });

      expect(Option.isNone(none)).toBe(true);
      expect(getSome(earliest)).toEqual(toStored(sooner));
      expect(getSome(latest)).toEqual(toStored(later));
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("treats a waiting job as active for its idempotency key", async () => {
    const program = E.gen(function* () {
      const first = yield* insertJob({ idempotencyKey: "a" });

      yield* claimAndPark(fromNow(10));

      const second = yield* insertJob({ idempotencyKey: "a" });

      expect(second.wasInserted).toBe(false);
      expect(second.job.id).toBe(first.job.id);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("leaves waiting jobs alone when recovering after a restart", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();

      const parked = yield* claimAndPark(fromNow(10));

      yield* backgroundJobDAO.recoverRunning({
        exhaustedError: EXHAUSTED_ERROR,
        maxAttempts: 1,
        queue: QUEUE,
      });

      const job = getSome(yield* backgroundJobDAO.getById({ id: parked.id }));

      expect(job.status).toBe("WAITING");
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes a waiting job", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();

      const parked = yield* claimAndPark(fromNow(10));

      yield* backgroundJobDAO.delete({
        id: parked.id,
        statuses: ["QUEUED", "WAITING"],
      });

      const job = yield* backgroundJobDAO.getById({ id: parked.id });

      expect(Option.isNone(job)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
});
