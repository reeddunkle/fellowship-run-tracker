import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsDungeonRunImporter,
  type FellowshipLogsDungeonRunImporterShape,
} from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FellowshipLogsGatewayRateLimitExceededError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { BackgroundJobRunner } from "@frt/api/services/background-job-runner/background-job-runner-service.ts";
import {
  type FellowshipLogsFetchControl,
  makeControlledFellowshipLogsFixtureLayer,
  makeFellowshipLogsFetchControl,
} from "@frt/api/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
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

function waitForJob(
  id: BackgroundJobId,
  predicate: (job: Option.Option<BackgroundJobModel>) => boolean,
) {
  return getJob(id).pipe(
    E.repeat({
      schedule: Schedule.spaced("10 millis"),
      until: predicate,
    }),
    E.timeout("5 seconds"),
    E.map(Option.getOrThrow),
  );
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
  }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);
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
          yield* E.sleep("100 millis");

          const secondWhileWaiting = yield* getJob(offeredSecond.job.id);
          const callsSoFar = [...calls];

          return {
            callsWhileWaiting: callsSoFar,
            first: yield* waitForJob(
              offeredFirst.job.id,
              hasStatus("SUCCEEDED"),
            ),
            second: yield* waitForJob(
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
            yield* E.sleep("100 millis");

            return {
              afterRestart: Option.getOrThrow(yield* getJob(jobId)),
              finished: yield* waitForJob(jobId, hasStatus("SUCCEEDED")),
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

        return yield* waitForJob(job.id, hasStatus("SUCCEEDED"));
      }).pipe(
        E.provide(makeFixtureImportTestLayer({ control, databaseFilename })),
      );
    });

    // The pages fetched before running out came from the cache the second
    // time, so each page was fetched once.
    expect(control.pagesFetched).toBe(13);
    expect(finished.result).toMatchObject({
      dungeonRunId: expect.any(String),
    });
  });
});
