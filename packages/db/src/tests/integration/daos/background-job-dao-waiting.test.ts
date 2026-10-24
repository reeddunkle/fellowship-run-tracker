import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { getSome } from "@frt/db/tests/common/get-some.ts";
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

const insertJob = E.fnUntraced(function* (options?: {
  readonly bindingKey?: string;
  readonly idempotencyKey?: string | null;
}) {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  return yield* backgroundJobDAO.insert({
    ...(options?.bindingKey === undefined
      ? {}
      : { bindingKey: options.bindingKey }),
    idempotencyKey: options?.idempotencyKey ?? null,
    kind: "TestJob",
    payload: { value: 1 },
    queue: QUEUE,
    traceparent: null,
  });
});

/** Claims the next job and parks it until `availableAt`. */
const claimAndPark = E.fnUntraced(function* (availableAt: DateTime.Utc) {
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
    waitingReason: "APPLICATION_QUOTA_RESET",
  });

  return job;
});

const claimAndParkOnCondition = E.fnUntraced(function* (
  waitingReason: "CONNECTION_REQUIRED" | "POINT_SYSTEM_OPT_IN_REQUIRED",
) {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  const job = getSome(
    yield* backgroundJobDAO.claimNext({
      holdWhileWaiting: false,
      queue: QUEUE,
    }),
  );

  yield* backgroundJobDAO.markWaiting({
    availableAt: null,
    id: job.id,
    reason: WAITING_REASON,
    waitingReason,
  });

  return job;
});

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
          waitingReason: "APPLICATION_QUOTA_RESET",
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

  test("parks a job on a condition with no reset time", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();

      const parked = yield* claimAndParkOnCondition("CONNECTION_REQUIRED");
      const job = getSome(yield* backgroundJobDAO.getById({ id: parked.id }));

      expect(job.status).toBe("WAITING");
      expect(job.waitingReason).toBe("CONNECTION_REQUIRED");
      expect(job.availableAt).toBeNull();
      expect(job.attempts).toBe(0);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("refuses a reset time for a condition, and a condition wait without one for a quota reset", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      yield* insertJob();

      const first = getSome(
        yield* backgroundJobDAO.claimNext({
          holdWhileWaiting: false,
          queue: QUEUE,
        }),
      );
      const second = getSome(
        yield* backgroundJobDAO.claimNext({
          holdWhileWaiting: false,
          queue: QUEUE,
        }),
      );

      const conditionWithReset = yield* backgroundJobDAO
        .markWaiting({
          availableAt: fromNow(10),
          id: first.id,
          reason: WAITING_REASON,
          waitingReason: "CONNECTION_REQUIRED",
        })
        .pipe(E.flip);
      const quotaWithoutReset = yield* backgroundJobDAO
        .markWaiting({
          availableAt: null,
          id: second.id,
          reason: WAITING_REASON,
          waitingReason: "USER_QUOTA_RESET",
        })
        .pipe(E.flip);

      expect(conditionWithReset.reason._tag).toBe("UnexpectedDatabaseError");
      expect(quotaWithoutReset.reason._tag).toBe("UnexpectedDatabaseError");
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("never claims a condition wait, and holds the queue behind it when asked to", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      const queued = yield* insertJob();

      yield* claimAndParkOnCondition("CONNECTION_REQUIRED");

      const held = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: true,
        queue: QUEUE,
      });
      const claimed = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });
      const nothingLeft = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      expect(Option.isNone(held)).toBe(true);
      expect(getSome(claimed).id).toBe(queued.job.id);
      expect(Option.isNone(nothingLeft)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("reports no next time for a held queue blocked on a condition", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      yield* insertJob();

      const timed = fromNow(10);

      yield* claimAndPark(timed);
      yield* claimAndParkOnCondition("POINT_SYSTEM_OPT_IN_REQUIRED");

      const held = yield* backgroundJobDAO.getNextAvailableAt({
        holdWhileWaiting: true,
        queue: QUEUE,
      });
      const earliest = yield* backgroundJobDAO.getNextAvailableAt({
        holdWhileWaiting: false,
        queue: QUEUE,
      });

      expect(Option.isNone(held)).toBe(true);
      expect(getSome(earliest)).toEqual(toStored(timed));
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("resumes only jobs waiting for the given reasons", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      yield* insertJob();
      yield* insertJob();

      const connection = yield* claimAndParkOnCondition("CONNECTION_REQUIRED");
      const optIn = yield* claimAndParkOnCondition(
        "POINT_SYSTEM_OPT_IN_REQUIRED",
      );
      const quota = yield* claimAndPark(fromNow(10));

      const resumedCount = yield* backgroundJobDAO.resumeWaiting({
        queue: QUEUE,
        waitingReasons: ["CONNECTION_REQUIRED", "USER_QUOTA_RESET"],
      });

      const resumed = getSome(
        yield* backgroundJobDAO.getById({ id: connection.id }),
      );
      const stillOptIn = getSome(
        yield* backgroundJobDAO.getById({ id: optIn.id }),
      );
      const stillQuota = getSome(
        yield* backgroundJobDAO.getById({ id: quota.id }),
      );

      expect(resumedCount).toBe(1);
      expect(resumed.status).toBe("QUEUED");
      expect(resumed.waitingReason).toBeNull();
      expect(resumed.error).toBeNull();
      expect(stillOptIn.waitingReason).toBe("POINT_SYSTEM_OPT_IN_REQUIRED");
      expect(stillQuota.waitingReason).toBe("APPLICATION_QUOTA_RESET");
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("holds quota waits from another connection, then resumes and rebinds one job on request", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob({ bindingKey: "old" });
      yield* insertJob({ bindingKey: "new" });
      yield* insertJob({ bindingKey: "old" });

      const quota = yield* claimAndPark(fromNow(10));
      const sameConnection = yield* claimAndPark(fromNow(10));
      const connection = yield* claimAndParkOnCondition("CONNECTION_REQUIRED");

      const heldCount = yield* backgroundJobDAO.holdWaiting({
        fromWaitingReasons: ["APPLICATION_QUOTA_RESET"],
        queue: QUEUE,
        toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
        unlessBindingKey: "new",
      });
      const held = getSome(yield* backgroundJobDAO.getById({ id: quota.id }));
      const stillQuota = getSome(
        yield* backgroundJobDAO.getById({ id: sameConnection.id }),
      );
      const untouched = getSome(
        yield* backgroundJobDAO.getById({ id: connection.id }),
      );

      const wrongReason = yield* backgroundJobDAO
        .resumeWaitingJob({
          bindingKey: "new",
          id: connection.id,
          waitingReasons: ["PROFILE_CHANGE_CONFIRMATION_REQUIRED"],
        })
        .pipe(E.flip);
      const resumed = yield* backgroundJobDAO.resumeWaitingJob({
        bindingKey: "new",
        id: quota.id,
        waitingReasons: ["PROFILE_CHANGE_CONFIRMATION_REQUIRED"],
      });

      expect(heldCount).toBe(1);
      expect(held.waitingReason).toBe("PROFILE_CHANGE_CONFIRMATION_REQUIRED");
      expect(held.availableAt).toBeNull();
      expect(stillQuota.waitingReason).toBe("APPLICATION_QUOTA_RESET");
      expect(untouched.waitingReason).toBe("CONNECTION_REQUIRED");
      expect(wrongReason.reason._tag).toBe("BackgroundJobNotFoundError");
      expect(resumed.status).toBe("QUEUED");
      expect(resumed.waitingReason).toBeNull();
      expect(resumed.bindingKey).toBe("new");
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("never holds a quota wait that isn't bound to a connection", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();

      const unbound = yield* claimAndPark(fromNow(10));

      const heldWhileConnected = yield* backgroundJobDAO.holdWaiting({
        fromWaitingReasons: ["APPLICATION_QUOTA_RESET"],
        queue: QUEUE,
        toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
        unlessBindingKey: "new",
      });
      const heldWhileDisconnected = yield* backgroundJobDAO.holdWaiting({
        fromWaitingReasons: ["APPLICATION_QUOTA_RESET"],
        queue: QUEUE,
        toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
        unlessBindingKey: null,
      });
      const job = getSome(yield* backgroundJobDAO.getById({ id: unbound.id }));

      expect(heldWhileConnected).toBe(0);
      expect(heldWhileDisconnected).toBe(0);
      expect(job.waitingReason).toBe("APPLICATION_QUOTA_RESET");
      expect(job.bindingKey).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("doesn't hold the queue behind a job waiting for a profile-change confirmation", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob({ bindingKey: "old" });
      const queued = yield* insertJob({ bindingKey: "new" });

      const held = yield* claimAndPark(fromNow(10));

      yield* backgroundJobDAO.holdWaiting({
        fromWaitingReasons: ["APPLICATION_QUOTA_RESET"],
        queue: QUEUE,
        toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
        unlessBindingKey: "new",
      });

      const heldJob = getSome(yield* backgroundJobDAO.getById({ id: held.id }));
      const claimed = yield* backgroundJobDAO.claimNext({
        holdWhileWaiting: true,
        queue: QUEUE,
      });

      expect(heldJob.waitingKind).toBe("HOLD");
      expect(getSome(claimed).id).toBe(queued.job.id);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("still wakes for a quota reset while another job waits for a profile-change confirmation", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob({ bindingKey: "old" });
      yield* insertJob({ bindingKey: "new" });

      yield* claimAndPark(fromNow(10));
      const resetAt = fromNow(20);
      yield* claimAndPark(resetAt);

      yield* backgroundJobDAO.holdWaiting({
        fromWaitingReasons: ["APPLICATION_QUOTA_RESET"],
        queue: QUEUE,
        toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
        unlessBindingKey: "new",
      });

      const nextAvailableAt = yield* backgroundJobDAO.getNextAvailableAt({
        holdWhileWaiting: true,
        queue: QUEUE,
      });

      expect(getSome(nextAvailableAt)).toEqual(toStored(resetAt));
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("records what kind of wait a parked job is in", async () => {
    const program = E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      yield* insertJob();
      yield* insertJob();

      const reset = yield* claimAndPark(fromNow(10));
      const condition = yield* claimAndParkOnCondition("CONNECTION_REQUIRED");

      const resumed = yield* backgroundJobDAO.resumeWaiting({
        queue: QUEUE,
        waitingReasons: ["CONNECTION_REQUIRED"],
      });

      expect(
        getSome(yield* backgroundJobDAO.getById({ id: reset.id })).waitingKind,
      ).toBe("RESET");
      expect(resumed).toBe(1);
      expect(
        getSome(yield* backgroundJobDAO.getById({ id: condition.id }))
          .waitingKind,
      ).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
});
