import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsDungeonRunImporter,
  type FellowshipLogsDungeonRunImporterShape,
} from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import {
  FellowshipLogsGatewayAccessError,
  FellowshipLogsGatewayPointPolicyError,
  FellowshipLogsGatewayRateLimitExceededError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";
import { ExpectedFellowshipLogsConnectionIdentity } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import { type FellowshipLogsGatewayWaitCause } from "@frt/api/services/fellowship-logs-gateway/get-fellowship-logs-gateway-wait.ts";
import {
  CONTROLLED_PAGE_COUNT,
  type FellowshipLogsFetchControl,
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { IgnoredFellowshipLogsImportCostLayer } from "@frt/api/tests/common/mocks/fellowship-logs-import-cost-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const BackgroundJobRunnerTestLive = BackgroundJobRunner.layerNoDeps.pipe(
  Layer.provide(NodePlatformLayer),
  Layer.provide(IgnoredFellowshipLogsImportCostLayer),
);

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

const OTHER_FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(16);

const STUB_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000000",
);

function makeImportJob(fightId = FIGHT_ID) {
  return {
    _tag: "ImportFellowshipLogsDungeonRun",
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    fightId,
    isOwnRun: true,
    reportCode: REPORT_CODE,
  } as const;
}

function makeBackgroundJobQueueTestLayer({
  databaseFilename,
  importReport,
}: {
  readonly databaseFilename: string;
  readonly importReport: FellowshipLogsDungeonRunImporterShape["importReport"];
}) {
  return BackgroundJobQueue.layerNoDeps.pipe(
    Layer.provide(BackgroundJobRunnerTestLive),
    Layer.provideMerge(
      Layer.merge(
        makePersistenceTestLayer(databaseFilename),
        Layer.succeed(FellowshipLogsDungeonRunImporter, { importReport }),
      ),
    ),
    Layer.provide(NodePlatformLayer),
  );
}

/** The job service running the real importer against the recorded fixture. */
function makeFixtureImportTestLayer({
  control,
  databaseFilename,
}: {
  readonly control: FellowshipLogsFetchControl;
  readonly databaseFilename: string;
}) {
  const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

  const FellowshipLogsTestLive = makeControlledFellowshipLogsFixtureLayer(
    control,
  ).pipe(Layer.provide(PersistenceTestLive));

  const ImporterTestLive = FellowshipLogsDungeonRunImporter.layerNoDeps.pipe(
    Layer.provide(Layer.merge(PersistenceTestLive, FellowshipLogsTestLive)),
  );

  return BackgroundJobQueue.layerNoDeps.pipe(
    Layer.provide(BackgroundJobRunnerTestLive),
    Layer.provideMerge(Layer.merge(PersistenceTestLive, ImporterTestLive)),
    Layer.provide(NodePlatformLayer),
  );
}

function getJob(id: BackgroundJobId) {
  return BackgroundJobDAO.use((dao) => {
    return dao.getById({ id });
  });
}

const WAIT_TIMEOUT = "5 seconds";

const CLOCK_STEP = "100 millis";

const NO_EARLY_RESUME_WINDOW = "100 millis";

function waitForJob(
  id: BackgroundJobId,
  predicate: (job: Option.Option<BackgroundJobModel>) => boolean,
) {
  return BackgroundJobQueue.use((backgroundJobQueue) => {
    return backgroundJobQueue.changes.pipe(
      Stream.mapEffect(() => {
        return getJob(id);
      }),
      Stream.filter(predicate),
      Stream.runHead,
    );
  }).pipe(
    E.map((job) => {
      return job.pipe(Option.flatten, Option.getOrThrow);
    }),
    E.timeout(WAIT_TIMEOUT),
    TestClock.withLive,
  );
}

function advanceClockUntilJob(
  id: BackgroundJobId,
  predicate: (job: Option.Option<BackgroundJobModel>) => boolean,
) {
  return TestClock.testClockWith((testClock) => {
    return testClock
      .adjust(CLOCK_STEP)
      .pipe(
        E.andThen(getJob(id)),
        E.repeat({ until: predicate }),
        E.map(Option.getOrThrow),
        E.timeout(WAIT_TIMEOUT),
        testClock.withLive,
      );
  });
}

function giveWorkerAChanceToResumeEarly() {
  return E.sleep(NO_EARLY_RESUME_WINDOW).pipe(TestClock.withLive);
}

function hasStatus(status: BackgroundJobModel["status"]) {
  return (job: Option.Option<BackgroundJobModel>) => {
    return Option.isSome(job) && job.value.status === status;
  };
}

function withTempDatabase<A, Error>(
  program: (databaseFilename: string) => E.Effect<A, Error>,
) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directory = yield* fileSystem.makeTempDirectoryScoped();

    return yield* program(path.join(directory, "database.db"));
  }).pipe(
    E.scoped,
    E.provide(Layer.merge(NodePlatformLayer, TestClock.layer())),
    runTest,
  );
}

const succeed: FellowshipLogsDungeonRunImporterShape["importReport"] = () => {
  return E.succeed({ dungeonRunId: STUB_DUNGEON_RUN_ID });
};

/**
 * An importer whose first import of `FIGHT_ID` runs out of points until
 * `delay` from now. Everything else succeeds.
 */
function makeRateLimitedImporter(delay: { readonly milliseconds: number }) {
  const calls: Array<number> = [];

  const importReport: FellowshipLogsDungeonRunImporterShape["importReport"] = ({
    fightId,
  }) => {
    calls.push(fightId);

    const isFirstCall =
      fightId === FIGHT_ID &&
      calls.filter((call) => {
        return call === FIGHT_ID;
      }).length === 1;

    if (!isFirstCall) {
      return succeed({ fightId, isOwnRun: true, reportCode: REPORT_CODE });
    }

    return DateTime.now.pipe(
      E.flatMap((now) => {
        return E.fail(
          new FellowshipLogsGatewayRateLimitExceededError({
            reason: "RejectedByApi",
            resetsAt: DateTime.add(now, delay),
          }),
        );
      }),
    );
  };

  return { calls, importReport };
}

describe("BackgroundJobQueue waiting jobs", () => {
  test("parks an import that runs out of points and holds the queue until they reset", async () => {
    const { calls, importReport } = makeRateLimitedImporter({
      milliseconds: 400,
    });

    const { callsWhileWaiting, first, second, waiting, waitingSecond } =
      await withTempDatabase((databaseFilename) => {
        return E.gen(function* () {
          const backgroundJobQueue = yield* BackgroundJobQueue;

          const offeredFirst = yield* backgroundJobQueue.offer(makeImportJob());
          const offeredSecond = yield* backgroundJobQueue.offer(
            makeImportJob(OTHER_FIGHT_ID),
          );

          const parked = yield* waitForJob(
            offeredFirst.job.id,
            hasStatus("WAITING"),
          );

          // Give the worker a chance to (wrongly) move on to the next import.
          yield* giveWorkerAChanceToResumeEarly();

          const secondWhileWaiting = yield* getJob(offeredSecond.job.id);
          const callsSoFar = [...calls];

          return {
            callsWhileWaiting: callsSoFar,
            first: yield* advanceClockUntilJob(
              offeredFirst.job.id,
              hasStatus("SUCCEEDED"),
            ),
            second: yield* advanceClockUntilJob(
              offeredSecond.job.id,
              hasStatus("SUCCEEDED"),
            ),
            waiting: parked,
            waitingSecond: secondWhileWaiting,
          };
        }).pipe(
          E.provide(
            makeBackgroundJobQueueTestLayer({
              databaseFilename,
              importReport,
            }),
          ),
        );
      });

    expect(waiting.availableAt).not.toBeNull();
    expect(waiting.attempts).toBe(0);
    expect(waiting.error?.tag).toBe(
      "FellowshipLogsGatewayRateLimitExceededError",
    );
    expect(callsWhileWaiting).toEqual([FIGHT_ID]);
    expect(Option.getOrThrow(waitingSecond).status).toBe("QUEUED");

    // The parked import resumes first, and the attempt it waited on wasn't
    // counted.
    expect(calls).toEqual([FIGHT_ID, FIGHT_ID, OTHER_FIGHT_ID]);
    expect(first.attempts).toBe(1);
    expect(first.availableAt).toBeNull();
    expect(first.error).toBeNull();
    expect(second.status).toBe("SUCCEEDED");
  });

  test("shows a waiting job with when it will resume", async () => {
    const { importReport } = makeRateLimitedImporter({ milliseconds: 60_000 });

    const visible = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobQueue = yield* BackgroundJobQueue;

        const { job } = yield* backgroundJobQueue.offer(makeImportJob());

        yield* waitForJob(job.id, hasStatus("WAITING"));

        return yield* backgroundJobQueue.listVisible();
      }).pipe(
        E.provide(
          makeBackgroundJobQueueTestLayer({ databaseFilename, importReport }),
        ),
      );
    });

    expect(visible).toHaveLength(1);
    expect(visible[0]?.job.status).toBe("WAITING");
    expect(visible[0]?.job.availableAt).not.toBeNull();
    expect(visible[0]?.progress).toBeNull();
  });

  test("cancels a waiting job", async () => {
    const { importReport } = makeRateLimitedImporter({ milliseconds: 60_000 });

    const job = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobQueue = yield* BackgroundJobQueue;

        const offered = yield* backgroundJobQueue.offer(makeImportJob());

        yield* waitForJob(offered.job.id, hasStatus("WAITING"));
        yield* backgroundJobQueue.cancel({ id: offered.job.id });

        return yield* getJob(offered.job.id);
      }).pipe(
        E.provide(
          makeBackgroundJobQueueTestLayer({ databaseFilename, importReport }),
        ),
      );
    });

    expect(Option.isNone(job)).toBe(true);
  });

  test("keeps a job waiting across a restart, then resumes it", async () => {
    const { importReport } = makeRateLimitedImporter({ milliseconds: 1_000 });

    const { afterRestart, finished } = await withTempDatabase(
      (databaseFilename) => {
        return E.gen(function* () {
          const jobId = yield* E.gen(function* () {
            const backgroundJobQueue = yield* BackgroundJobQueue;

            const { job } = yield* backgroundJobQueue.offer(makeImportJob());

            yield* waitForJob(job.id, hasStatus("WAITING"));

            return job.id;
          }).pipe(
            E.provide(
              makeBackgroundJobQueueTestLayer({
                databaseFilename,
                importReport,
              }),
            ),
          );

          return yield* E.gen(function* () {
            // Let the new session's recovery and worker start up.
            yield* giveWorkerAChanceToResumeEarly();

            return {
              afterRestart: Option.getOrThrow(yield* getJob(jobId)),
              finished: yield* advanceClockUntilJob(
                jobId,
                hasStatus("SUCCEEDED"),
              ),
            };
          }).pipe(
            E.provide(
              makeBackgroundJobQueueTestLayer({
                databaseFilename,
                importReport: succeed,
              }),
            ),
          );
        });
      },
    );

    expect(afterRestart.status).toBe("WAITING");
    expect(finished.attempts).toBe(1);
  });

  test("resumes a waiting import from the page it stopped on", async () => {
    const control = makeFellowshipLogsFetchControl();

    control.failAfterPages = 5;
    control.failureResetDelayMilliseconds = 300;

    const finished = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobQueue = yield* BackgroundJobQueue;

        const { job } = yield* backgroundJobQueue.offer(makeImportJob());

        yield* waitForJob(job.id, hasStatus("WAITING"));

        control.failAfterPages = undefined;

        return yield* advanceClockUntilJob(job.id, hasStatus("SUCCEEDED"));
      }).pipe(
        E.provide(makeFixtureImportTestLayer({ control, databaseFilename })),
      );
    });

    // The pages fetched before running out came from the cache the second
    // time, so each page was fetched once.
    expect(control.pagesFetched).toBe(CONTROLLED_PAGE_COUNT);
    expect(finished.result).toMatchObject({
      dungeonRunId: expect.any(String),
    });
  });
});

function makeFailingOnceImporter(error: FellowshipLogsGatewayWaitCause) {
  const calls: Array<number> = [];
  const expectedIdentities: Array<string | null> = [];

  const importReport: FellowshipLogsDungeonRunImporterShape["importReport"] = ({
    fightId,
  }) => {
    calls.push(fightId);

    return E.gen(function* () {
      expectedIdentities.push(yield* ExpectedFellowshipLogsConnectionIdentity);

      return calls.length === 1
        ? yield* error
        : yield* succeed({ fightId, isOwnRun: true, reportCode: REPORT_CODE });
    });
  };

  return { calls, expectedIdentities, importReport };
}

describe("BackgroundJobQueue condition waits", () => {
  test("parks an import until the connection is fixed, holding the queue without retrying", async () => {
    const { calls, importReport } = makeFailingOnceImporter(
      new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "NotConnected",
      }),
    );

    const result = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobQueue = yield* BackgroundJobQueue;

        const offeredFirst = yield* backgroundJobQueue.offer(makeImportJob());
        const offeredSecond = yield* backgroundJobQueue.offer(
          makeImportJob(OTHER_FIGHT_ID),
        );

        const waiting = yield* waitForJob(
          offeredFirst.job.id,
          hasStatus("WAITING"),
        );

        yield* giveWorkerAChanceToResumeEarly();

        const callsWhileWaiting = [...calls];
        const secondWhileWaiting = Option.getOrThrow(
          yield* getJob(offeredSecond.job.id),
        );
        const ignoredCount = yield* backgroundJobQueue.resumeWaiting({
          queue: "fellowship-logs-import",
          waitingReasons: ["POINT_SYSTEM_OPT_IN_REQUIRED"],
        });
        const resumedCount = yield* backgroundJobQueue.resumeWaiting({
          queue: "fellowship-logs-import",
          waitingReasons: ["CONNECTION_REQUIRED"],
        });

        return {
          callsWhileWaiting,
          first: yield* waitForJob(offeredFirst.job.id, hasStatus("SUCCEEDED")),
          ignoredCount,
          resumedCount,
          second: yield* waitForJob(
            offeredSecond.job.id,
            hasStatus("SUCCEEDED"),
          ),
          secondWhileWaiting,
          visible: yield* backgroundJobQueue.listVisible(),
          waiting,
        };
      }).pipe(
        E.provide(
          makeBackgroundJobQueueTestLayer({ databaseFilename, importReport }),
        ),
      );
    });

    expect(result.waiting.waitingReason).toBe("CONNECTION_REQUIRED");
    expect(result.waiting.availableAt).toBeNull();
    expect(result.waiting.attempts).toBe(0);
    expect(result.callsWhileWaiting).toEqual([FIGHT_ID]);
    expect(result.secondWhileWaiting.status).toBe("QUEUED");
    expect(result.ignoredCount).toBe(0);
    expect(result.resumedCount).toBe(1);
    expect(result.first.attempts).toBe(1);
    expect(result.first.waitingReason).toBeNull();
    expect(result.second.status).toBe("SUCCEEDED");
    expect(calls).toEqual([FIGHT_ID, FIGHT_ID, OTHER_FIGHT_ID]);
  });

  test.each([
    {
      error: new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "ReauthorizationRequired",
      }),
      hasResetTime: false,
      waitingReason: "REAUTHORIZATION_REQUIRED",
    },
    {
      error: new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "LocalProtectionAcknowledgementRequired",
      }),
      hasResetTime: false,
      waitingReason: "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
    },
    {
      error: new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "ConnectionChanged",
      }),
      hasResetTime: false,
      waitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
    },
    {
      error: new FellowshipLogsGatewayPointPolicyError({
        reason: "PointSystemOptInRequired",
      }),
      hasResetTime: false,
      waitingReason: "POINT_SYSTEM_OPT_IN_REQUIRED",
    },
    {
      error: new FellowshipLogsGatewayRateLimitExceededError({
        reason: "UserPointsExhausted",
        resetsAt: DateTime.makeUnsafe("2999-01-01T00:00:00.000Z"),
      }),
      hasResetTime: true,
      waitingReason: "USER_QUOTA_RESET",
    },
    {
      error: new FellowshipLogsGatewayRateLimitExceededError({
        reason: "ApplicationHoldUnavailable",
        resetsAt: DateTime.makeUnsafe("2999-01-01T00:00:00.000Z"),
      }),
      hasResetTime: true,
      waitingReason: "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
    },
  ])(
    "parks an import refused by $error._tag $error.reason as $waitingReason",
    async ({ error, hasResetTime, waitingReason }) => {
      const { calls, importReport } = makeFailingOnceImporter(error);

      const waiting = await withTempDatabase((databaseFilename) => {
        return E.gen(function* () {
          const backgroundJobQueue = yield* BackgroundJobQueue;
          const { job } = yield* backgroundJobQueue.offer(makeImportJob());

          return yield* waitForJob(job.id, hasStatus("WAITING"));
        }).pipe(
          E.provide(
            makeBackgroundJobQueueTestLayer({ databaseFilename, importReport }),
          ),
        );
      });

      expect(waiting.waitingReason).toBe(waitingReason);
      expect(waiting.availableAt !== null).toBe(hasResetTime);
      expect(waiting.error?.tag).toBe(error._tag);
      expect(calls).toEqual([FIGHT_ID]);
    },
  );

  test("fails an import the active policy can never run, without retrying", async () => {
    const { calls, importReport } = makeFailingOnceImporter(
      new FellowshipLogsGatewayPointPolicyError({ reason: "NotUserEligible" }),
    );

    const failed = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobQueue = yield* BackgroundJobQueue;
        const { job } = yield* backgroundJobQueue.offer(makeImportJob());

        return yield* waitForJob(job.id, hasStatus("FAILED"));
      }).pipe(
        E.provide(
          makeBackgroundJobQueueTestLayer({ databaseFilename, importReport }),
        ),
      );
    });

    expect(failed.error?.tag).toBe("FellowshipLogsGatewayPointPolicyError");
    expect(failed.waitingReason).toBeNull();
    expect(calls).toEqual([FIGHT_ID]);
  });

  test("runs a quota wait held for a profile change only once it is resumed with the new connection", async () => {
    const { calls, expectedIdentities, importReport } = makeFailingOnceImporter(
      new FellowshipLogsGatewayRateLimitExceededError({
        reason: "UserPointsExhausted",
        resetsAt: DateTime.makeUnsafe("2999-01-01T00:00:00.000Z"),
      }),
    );

    const result = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobQueue = yield* BackgroundJobQueue;
        const { job } = yield* backgroundJobQueue.offer(makeImportJob(), {
          bindingKey: "old",
        });

        yield* waitForJob(job.id, hasStatus("WAITING"));

        const heldCount = yield* backgroundJobQueue.holdWaiting({
          fromWaitingReasons: ["USER_QUOTA_RESET"],
          queue: "fellowship-logs-import",
          toWaitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
          unlessBindingKey: "new",
        });
        const held = Option.getOrThrow(yield* getJob(job.id));

        yield* backgroundJobQueue.resumeWaitingJob({
          bindingKey: "new",
          id: job.id,
          waitingReasons: ["PROFILE_CHANGE_CONFIRMATION_REQUIRED"],
        });

        return {
          held,
          heldCount,
          succeeded: yield* waitForJob(job.id, hasStatus("SUCCEEDED")),
        };
      }).pipe(
        E.provide(
          makeBackgroundJobQueueTestLayer({ databaseFilename, importReport }),
        ),
      );
    });

    expect(result.heldCount).toBe(1);
    expect(result.held.waitingReason).toBe(
      "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
    );
    expect(result.held.availableAt).toBeNull();
    expect(result.succeeded.status).toBe("SUCCEEDED");
    expect(result.succeeded.bindingKey).toBe("new");
    expect(calls).toEqual([FIGHT_ID, FIGHT_ID]);
    expect(expectedIdentities).toEqual(["old", "new"]);
  });
});
