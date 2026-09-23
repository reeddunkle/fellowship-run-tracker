import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { runBackgroundJob } from "@frt/api/services/background-job/run-background-job.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { BackgroundJobIdSchema } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

const UNUSED_JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)("unused-job");

const UnusedFellowshipLogsDungeonRunImporter = Layer.succeed(
  FellowshipLogsDungeonRunImporter,
  {
    importReport: () => {
      return E.die("unexpected call: importReport");
    },
  },
);

const finishJob = E.fn("test.finish-background-job")(function* ({
  queue,
  status,
}: {
  readonly queue: string;
  readonly status: "FAILED" | "SUCCEEDED";
}) {
  const backgroundJobDAO = yield* BackgroundJobDAO;

  const { job } = yield* backgroundJobDAO.insert({
    idempotencyKey: null,
    kind: "Test",
    payload: {},
    queue,
  });

  yield* backgroundJobDAO.claimNext({ holdWhileWaiting: false, queue });

  yield* status === "FAILED"
    ? backgroundJobDAO.markFailed({
        error: { message: "Boom.", tag: "Boom" },
        id: job.id,
      })
    : backgroundJobDAO.markSucceeded({ id: job.id, result: null });

  return job.id;
});

describe("PruneFinishedBackgroundJobs job", () => {
  test("prunes succeeded jobs and hidden failures but keeps visible failures", async () => {
    const remaining = await E.gen(function* () {
      const backgroundJobDAO = yield* BackgroundJobDAO;

      const succeededImport = yield* finishJob({
        queue: "fellowship-logs-import",
        status: "SUCCEEDED",
      });
      const failedImport = yield* finishJob({
        queue: "fellowship-logs-import",
        status: "FAILED",
      });
      const failedMaintenance = yield* finishJob({
        queue: "maintenance",
        status: "FAILED",
      });

      yield* runBackgroundJob(
        {
          _tag: "PruneFinishedBackgroundJobs",
          finishedBefore: DateTime.add(yield* DateTime.now, { minutes: 1 }),
        },
        { jobId: UNUSED_JOB_ID, reportProgress: () => E.void },
      ).pipe(
        E.provide(
          Layer.merge(
            UnusedFellowshipLogsDungeonRunImporter,
            NodePlatformLayer,
          ),
        ),
      );

      return {
        failedImport: yield* backgroundJobDAO.getById({ id: failedImport }),
        failedMaintenance: yield* backgroundJobDAO.getById({
          id: failedMaintenance,
        }),
        succeededImport: yield* backgroundJobDAO.getById({
          id: succeededImport,
        }),
      };
    }).pipe(E.provide(makePersistenceTestLayer()), runTest);

    expect(Option.isNone(remaining.succeededImport)).toBe(true);
    expect(Option.isNone(remaining.failedMaintenance)).toBe(true);
    expect(Option.isSome(remaining.failedImport)).toBe(true);
  });
});
