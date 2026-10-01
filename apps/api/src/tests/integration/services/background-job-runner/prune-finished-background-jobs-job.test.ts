import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runBackgroundJob } from "@frt/api/tests/common/run-background-job.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";

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
    traceparent: null,
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

      yield* runBackgroundJob({
        _tag: "PruneFinishedBackgroundJobs",
        finishedBefore: DateTime.add(yield* DateTime.now, { minutes: 1 }),
      });

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
