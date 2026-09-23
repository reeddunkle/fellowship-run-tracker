import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsDungeonRunImporter,
  type FellowshipLogsDungeonRunImporterServiceShape,
} from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { FellowshipLogsDungeonRunImportRunNotFoundError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { BackgroundJobService } from "@frt/api/services/background-job/background-job-service.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { makeFellowshipLogsDungeonRunImporterIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-logs-dungeon-run-importer-integration-test-harness.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  BackgroundJobDAO,
  type BackgroundJobDAOShape,
} from "@frt/db/daos/background-job/background-job-dao.ts";
import { makeBackgroundJobDAO } from "@frt/db/daos/background-job/make-background-job-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

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

const OTHER_FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(16);

function makeStubImporterLayer(
  importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"],
) {
  return Layer.succeed(FellowshipLogsDungeonRunImporter, { importReport });
}

function makeBackgroundJobServiceTestLayer({
  databaseFilename,
  importReport,
}: {
  readonly databaseFilename: string;
  readonly importReport?: FellowshipLogsDungeonRunImporterServiceShape["importReport"];
}) {
  const DependenciesTestLive =
    importReport === undefined
      ? makeFellowshipLogsDungeonRunImporterIntegrationTestHarness({
          databaseFilename,
        }).layer
      : Layer.merge(
          makePersistenceTestLayer(databaseFilename),
          makeStubImporterLayer(importReport),
        );

  return BackgroundJobService.layerNoDeps.pipe(
    Layer.provideMerge(DependenciesTestLive),
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

const blockForever: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
  () => {
    return E.never;
  };

describe("BackgroundJobService", () => {
  test("runs a maintenance job and marks it succeeded", async () => {
    const { finalJob, status } = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;
        const dungeonRunRepository = yield* DungeonRunRepository;

        const dungeonRun = yield* dungeonRunRepository.createLocal({
          dungeonId: MOCK_DUNGEON_ID,
          dungeonLevel: MOCK_DUNGEON_LEVEL,
        });

        yield* E.sleep("5 millis");

        const { job } = yield* backgroundJobService.offer({
          _tag: "InterruptUnfinishedDungeonRuns",
          createdBefore: yield* DateTime.now,
        });

        const settled = yield* waitForJob(job.id, hasStatus("SUCCEEDED"));

        const localRun = yield* LocalLogDungeonRunDAO.use((dao) => {
          return dao.getByDungeonRunId({ dungeonRunId: dungeonRun.id });
        });

        return {
          finalJob: Option.getOrThrow(settled),
          status: Option.getOrThrow(localRun).status,
        };
      }).pipe(
        E.provide(makeBackgroundJobServiceTestLayer({ databaseFilename })),
      );
    });

    expect(status).toBe("INTERRUPTED");
    expect(finalJob.queue).toBe("maintenance");
    expect(finalJob.attempts).toBe(1);
  });

  test("imports a Fellowship Logs run and records its result", async () => {
    const { job, visible } = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;

        const offered = yield* backgroundJobService.offer(makeImportJob());

        const settled = yield* waitForJob(
          offered.job.id,
          hasStatus("SUCCEEDED"),
        );

        return {
          job: Option.getOrThrow(settled),
          visible: yield* backgroundJobService.listVisible(),
        };
      }).pipe(
        E.provide(makeBackgroundJobServiceTestLayer({ databaseFilename })),
      );
    });

    expect(job.result).toMatchObject({ dungeonRunId: expect.any(String) });
    expect(visible.map((visibleJob) => visibleJob.job.id)).toEqual([job.id]);
  });

  test("returns the existing job when the same import is offered twice", async () => {
    const { first, second } = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;

        return {
          first: yield* backgroundJobService.offer(makeImportJob()),
          second: yield* backgroundJobService.offer(makeImportJob()),
        };
      }).pipe(
        E.provide(
          makeBackgroundJobServiceTestLayer({
            databaseFilename,
            importReport: blockForever,
          }),
        ),
      );
    });

    expect(first.wasAlreadyQueued).toBe(false);
    expect(second.wasAlreadyQueued).toBe(true);
    expect(second.job.id).toBe(first.job.id);
  });

  test("cancels a queued job and a running job", async () => {
    const { queuedJob, runningJob, wasInterrupted } = await withTempDatabase(
      (databaseFilename) => {
        return E.gen(function* () {
          const started = yield* Deferred.make<void>();
          const interrupted = yield* Deferred.make<void>();

          const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
            () => {
              return Deferred.succeed(started, undefined).pipe(
                E.andThen(E.never),
                E.onInterrupt(() => {
                  return Deferred.succeed(interrupted, undefined);
                }),
              );
            };

          return yield* E.gen(function* () {
            const backgroundJobService = yield* BackgroundJobService;

            const running = yield* backgroundJobService.offer(makeImportJob());
            const queued = yield* backgroundJobService.offer(
              makeImportJob(OTHER_FIGHT_ID),
            );

            // Wait for the import itself to start, so cancelling has a running
            // fiber to interrupt.
            yield* Deferred.await(started).pipe(E.timeout("5 seconds"));

            yield* backgroundJobService.cancel({ id: queued.job.id });
            yield* backgroundJobService.cancel({ id: running.job.id });

            yield* Deferred.await(interrupted).pipe(E.timeout("5 seconds"));

            return {
              queuedJob: yield* getJob(queued.job.id),
              runningJob: yield* waitForJob(running.job.id, Option.isNone),
              wasInterrupted: yield* Deferred.isDone(interrupted),
            };
          }).pipe(
            E.provide(
              makeBackgroundJobServiceTestLayer({
                databaseFilename,
                importReport,
              }),
            ),
          );
        });
      },
    );

    expect(Option.isNone(queuedJob)).toBe(true);
    expect(Option.isNone(runningJob)).toBe(true);
    expect(wasInterrupted).toBe(true);
  });

  test("fails with NotFound when cancelling a finished job", async () => {
    const error = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;

        const { job } = yield* backgroundJobService.offer(makeImportJob());

        yield* waitForJob(job.id, hasStatus("SUCCEEDED"));

        return yield* backgroundJobService.cancel({ id: job.id }).pipe(E.flip);
      }).pipe(
        E.provide(
          makeBackgroundJobServiceTestLayer({
            databaseFilename,
            importReport: () => {
              return E.succeed({ dungeonRunId: STUB_DUNGEON_RUN_ID });
            },
          }),
        ),
      );
    });

    expect(error._tag).toBe("BackgroundJobNotFoundError");
  });

  test("records a failure, then runs the job again on retry", async () => {
    const { failedJob, retriedJob } = await withTempDatabase(
      (databaseFilename) => {
        let calls = 0;

        const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
          ({ fightId, reportCode }) => {
            calls += 1;

            return calls === 1
              ? E.fail(
                  new FellowshipLogsDungeonRunImportRunNotFoundError({
                    fightId,
                    reportCode,
                  }),
                )
              : E.succeed({ dungeonRunId: STUB_DUNGEON_RUN_ID });
          };

        return E.gen(function* () {
          const backgroundJobService = yield* BackgroundJobService;

          const { job } = yield* backgroundJobService.offer(makeImportJob());

          const failed = yield* waitForJob(job.id, hasStatus("FAILED"));

          yield* backgroundJobService.retry({ id: job.id });

          const retried = yield* waitForJob(job.id, hasStatus("SUCCEEDED"));

          return {
            failedJob: Option.getOrThrow(failed),
            retriedJob: Option.getOrThrow(retried),
          };
        }).pipe(
          E.provide(
            makeBackgroundJobServiceTestLayer({
              databaseFilename,
              importReport,
            }),
          ),
        );
      },
    );

    expect(failedJob.error).toEqual({
      message: `No dungeon run found in report ${REPORT_CODE}, fight ${FIGHT_ID}.`,
      tag: "FellowshipLogsDungeonRunImportRunNotFoundError",
    });
    expect(retriedJob.error).toBeNull();
    expect(retriedJob.result).toEqual({ dungeonRunId: STUB_DUNGEON_RUN_ID });
  });

  test("resumes a job that was running when the app closed", async () => {
    const { interruptedStatus, resumedJob } = await withTempDatabase(
      (databaseFilename) => {
        return E.gen(function* () {
          const firstSession = yield* E.gen(function* () {
            const backgroundJobService = yield* BackgroundJobService;

            const { job } = yield* backgroundJobService.offer(makeImportJob());

            const running = yield* waitForJob(job.id, hasStatus("RUNNING"));

            return {
              interruptedStatus: Option.getOrThrow(running).status,
              jobId: job.id,
            };
          }).pipe(
            E.provide(
              makeBackgroundJobServiceTestLayer({
                databaseFilename,
                importReport: blockForever,
              }),
            ),
          );

          const resumed = yield* waitForJob(
            firstSession.jobId,
            hasStatus("SUCCEEDED"),
          ).pipe(
            E.provide(
              makeBackgroundJobServiceTestLayer({
                databaseFilename,
                importReport: () => {
                  return E.succeed({ dungeonRunId: STUB_DUNGEON_RUN_ID });
                },
              }),
            ),
          );

          return {
            interruptedStatus: firstSession.interruptedStatus,
            resumedJob: Option.getOrThrow(resumed),
          };
        });
      },
    );

    expect(interruptedStatus).toBe("RUNNING");
    expect(resumedJob.attempts).toBe(2);
  });

  test("shows a running job's progress until it finishes", async () => {
    const { afterSuccess, whileRunning } = await withTempDatabase(
      (databaseFilename) => {
        return E.gen(function* () {
          const reported = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();

          const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
            ({ onProgress }) => {
              return E.gen(function* () {
                yield* onProgress?.(0.5) ?? E.void;
                yield* Deferred.succeed(reported, undefined);
                yield* Deferred.await(release);

                return { dungeonRunId: STUB_DUNGEON_RUN_ID };
              });
            };

          return yield* E.gen(function* () {
            const backgroundJobService = yield* BackgroundJobService;

            const { job } = yield* backgroundJobService.offer(makeImportJob());

            yield* Deferred.await(reported).pipe(E.timeout("5 seconds"));

            const running = yield* backgroundJobService.listVisible();

            yield* Deferred.succeed(release, undefined);
            yield* waitForJob(job.id, hasStatus("SUCCEEDED"));

            return {
              afterSuccess: yield* backgroundJobService.listVisible(),
              whileRunning: running,
            };
          }).pipe(
            E.provide(
              makeBackgroundJobServiceTestLayer({
                databaseFilename,
                importReport,
              }),
            ),
          );
        });
      },
    );

    expect(whileRunning).toHaveLength(1);
    expect(whileRunning[0]?.job.status).toBe("RUNNING");
    expect(whileRunning[0]?.progress).toBe(0.5);
    expect(afterSuccess[0]?.job.status).toBe("SUCCEEDED");
    expect(afterSuccess[0]?.progress).toBeNull();
  });

  test("clears progress when a running job is cancelled", async () => {
    const { progressAfterReport, visibleAfterCancel } = await withTempDatabase(
      (databaseFilename) => {
        return E.gen(function* () {
          const reported = yield* Deferred.make<void>();

          const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
            ({ onProgress }) => {
              return E.gen(function* () {
                yield* onProgress?.(0.25) ?? E.void;
                yield* Deferred.succeed(reported, undefined);

                return yield* E.never;
              });
            };

          return yield* E.gen(function* () {
            const backgroundJobService = yield* BackgroundJobService;

            const { job } = yield* backgroundJobService.offer(makeImportJob());

            yield* Deferred.await(reported).pipe(E.timeout("5 seconds"));

            const beforeCancel = yield* backgroundJobService.listVisible();

            yield* backgroundJobService.cancel({ id: job.id });
            yield* waitForJob(job.id, Option.isNone);

            return {
              progressAfterReport: beforeCancel[0]?.progress,
              visibleAfterCancel: yield* backgroundJobService.listVisible(),
            };
          }).pipe(
            E.provide(
              makeBackgroundJobServiceTestLayer({
                databaseFilename,
                importReport,
              }),
            ),
          );
        });
      },
    );

    expect(progressAfterReport).toBe(0.25);
    expect(visibleAfterCancel).toEqual([]);
  });

  test("rejects cancelling a finished job and still runs its retry", async () => {
    const { cancelError, retriedJob } = await withTempDatabase(
      (databaseFilename) => {
        let calls = 0;

        const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
          ({ fightId, reportCode }) => {
            calls += 1;

            return calls === 1
              ? E.fail(
                  new FellowshipLogsDungeonRunImportRunNotFoundError({
                    fightId,
                    reportCode,
                  }),
                )
              : E.succeed({ dungeonRunId: STUB_DUNGEON_RUN_ID });
          };

        return E.gen(function* () {
          const backgroundJobService = yield* BackgroundJobService;

          const { job } = yield* backgroundJobService.offer(makeImportJob());

          yield* waitForJob(job.id, hasStatus("FAILED"));

          const error = yield* backgroundJobService
            .cancel({ id: job.id })
            .pipe(E.flip);

          // A cancel that arrives after the job finished must not linger and
          // then delete the retried job, which reuses the same id.
          yield* backgroundJobService.retry({ id: job.id });

          const retried = yield* waitForJob(job.id, hasStatus("SUCCEEDED"));

          return {
            cancelError: error,
            retriedJob: Option.getOrThrow(retried),
          };
        }).pipe(
          E.provide(
            makeBackgroundJobServiceTestLayer({
              databaseFilename,
              importReport,
            }),
          ),
        );
      },
    );

    expect(cancelError._tag).toBe("BackgroundJobNotFoundError");
    expect(retriedJob.result).toEqual({ dungeonRunId: STUB_DUNGEON_RUN_ID });
  });

  test("marks an import job succeeded when its run was already imported", async () => {
    const { existingDungeonRunId, job } = await withTempDatabase(
      (databaseFilename) => {
        return E.gen(function* () {
          const backgroundJobService = yield* BackgroundJobService;
          const importer = yield* FellowshipLogsDungeonRunImporter;

          // As if the app stopped after the import committed but before the
          // job was marked succeeded.
          const existing = yield* importer.importReport({
            fightId: FIGHT_ID,
            isOwnRun: true,
            reportCode: REPORT_CODE,
          });

          const offered = yield* backgroundJobService.offer(makeImportJob());

          const settled = yield* waitForJob(
            offered.job.id,
            hasStatus("SUCCEEDED"),
          );

          return {
            existingDungeonRunId: existing.dungeonRunId,
            job: Option.getOrThrow(settled),
          };
        }).pipe(
          E.provide(makeBackgroundJobServiceTestLayer({ databaseFilename })),
        );
      },
    );

    expect(job.result).toEqual({ dungeonRunId: existingDungeonRunId });
  });

  test("keeps processing a queue after an unexpected worker defect", async () => {
    const job = await withTempDatabase((databaseFilename) => {
      let claims = 0;

      const FlakyBackgroundJobDAOLive = Layer.effect(
        BackgroundJobDAO,
        E.gen(function* () {
          const backgroundJobDAO = yield* makeBackgroundJobDAO;

          return {
            ...backgroundJobDAO,
            claimNext: (options) => {
              claims += 1;

              return claims === 1
                ? E.die(new Error("Unexpected claim failure."))
                : backgroundJobDAO.claimNext(options);
            },
          } satisfies BackgroundJobDAOShape;
        }),
      );

      const PersistenceTestLive = makePersistenceTestLayer(databaseFilename);

      const BackgroundJobServiceTestLive =
        BackgroundJobService.layerNoDeps.pipe(
          Layer.provide(FlakyBackgroundJobDAOLive),
          Layer.provideMerge(
            Layer.merge(
              PersistenceTestLive,
              makeStubImporterLayer(() => {
                return E.succeed({ dungeonRunId: STUB_DUNGEON_RUN_ID });
              }),
            ),
          ),
          Layer.provide(NodePlatformLayer),
        );

      return E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;

        const { job: offered } = yield* backgroundJobService.offer(
          makeImportJob(),
        );

        const settled = yield* waitForJob(offered.id, hasStatus("SUCCEEDED"));

        return Option.getOrThrow(settled);
      }).pipe(E.provide(BackgroundJobServiceTestLive));
    });

    expect(job.status).toBe("SUCCEEDED");
  });

  test("emits a new revision when a job changes", async () => {
    const revisions = await withTempDatabase((databaseFilename) => {
      return E.gen(function* () {
        const backgroundJobService = yield* BackgroundJobService;

        const initial = yield* backgroundJobService.revision;

        yield* backgroundJobService.offer(makeImportJob());

        return yield* backgroundJobService.changes.pipe(
          Stream.filter((revision) => {
            return revision > initial;
          }),
          Stream.take(1),
          Stream.runCollect,
          E.timeout("5 seconds"),
        );
      }).pipe(
        E.provide(
          makeBackgroundJobServiceTestLayer({
            databaseFilename,
            importReport: blockForever,
          }),
        ),
      );
    });

    expect(revisions).toHaveLength(1);
  });
});
