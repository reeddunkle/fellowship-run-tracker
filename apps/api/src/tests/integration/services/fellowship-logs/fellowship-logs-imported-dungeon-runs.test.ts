import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { BackgroundJobPayloadSchema } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import {
  BackgroundJobQueue,
  type BackgroundJobQueueShape,
} from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { getBackgroundJobIdempotencyKey } from "@frt/api/services/background-job-queue/get-background-job-idempotency-key.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { makeFellowshipLogsDungeonRunImporterIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-logs-dungeon-run-importer-integration-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { MOCK_DUNGEON_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

const QUEUE_OPTIONS = {
  dungeonId: MOCK_DUNGEON_ID,
  dungeonLevel: 10,
  fightId: FIGHT_ID,
  isOwnRun: false,
  reportCode: REPORT_CODE,
};

function unexpectedCall(name: string) {
  return () => {
    return E.die(`unexpected call: ${name}`);
  };
}

const BackgroundJobServiceTestLive = Layer.effect(
  BackgroundJobQueue,
  E.gen(function* () {
    const backgroundJobDAO = yield* BackgroundJobDAO;

    return {
      cancel: unexpectedCall("cancel"),
      changes: Stream.empty,
      dismiss: unexpectedCall("dismiss"),
      listVisible: unexpectedCall("listVisible"),
      offer: (job) => {
        return E.gen(function* () {
          const { job: row, wasInserted } = yield* backgroundJobDAO.insert({
            idempotencyKey: getBackgroundJobIdempotencyKey(job),
            kind: job._tag,
            payload: yield* Schema.encodeEffect(BackgroundJobPayloadSchema)(
              job,
            ),
            queue: "test",
          });

          return { job: row, wasAlreadyQueued: !wasInserted };
        }).pipe(E.orDie);
      },
      retry: unexpectedCall("retry"),
      revision: E.succeed(0),
      sessionId: "test",
    } satisfies BackgroundJobQueueShape;
  }),
);

function makeTestLayer() {
  const harness = makeFellowshipLogsDungeonRunImporterIntegrationTestHarness();

  const FellowshipLogsTestLive = FellowshipLogs.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        harness.layer,
        BackgroundJobServiceTestLive.pipe(Layer.provide(harness.layer)),
      ),
    ),
  );

  return Layer.merge(harness.layer, FellowshipLogsTestLive);
}

const importRun = FellowshipLogsDungeonRunImporter.use((importer) => {
  return importer.importReport({
    fightId: FIGHT_ID,
    isOwnRun: false,
    reportCode: REPORT_CODE,
  });
});

describe("FellowshipLogs imported dungeon runs", () => {
  test("lists and deletes an imported run", async () => {
    const program = E.gen(function* () {
      const fellowshipLogs = yield* FellowshipLogs;

      const importResult = yield* importRun;

      const importedRuns = yield* fellowshipLogs.getImportedDungeonRuns();

      expect(importedRuns).toHaveLength(1);
      expect(importedRuns[0]?.dungeonRunId).toBe(importResult.dungeonRunId);
      expect(importedRuns[0]?.reportCode).toBe(REPORT_CODE);
      expect(importedRuns[0]?.fightId).toBe(FIGHT_ID);

      yield* fellowshipLogs.deleteImportedDungeonRun({
        dungeonRunId: importResult.dungeonRunId,
      });

      const importedRunsAfterDelete =
        yield* fellowshipLogs.getImportedDungeonRuns();

      expect(importedRunsAfterDelete).toHaveLength(0);
    }).pipe(E.provide(makeTestLayer()));

    await runTest(program);
  });

  test("fails with RunNotFound when deleting a run that does not exist", async () => {
    const program = E.gen(function* () {
      const fellowshipLogs = yield* FellowshipLogs;

      const importResult = yield* importRun;

      yield* fellowshipLogs.deleteImportedDungeonRun({
        dungeonRunId: importResult.dungeonRunId,
      });

      const result = yield* fellowshipLogs
        .deleteImportedDungeonRun({
          dungeonRunId: importResult.dungeonRunId,
        })
        .pipe(E.flip);

      expect(result.reason._tag).toBe("DungeonRunNotFoundError");
    }).pipe(E.provide(makeTestLayer()));

    await runTest(program);
  });
});

describe("FellowshipLogs.queueDungeonRunImport", () => {
  test("queues an import and reports a repeat as already queued", async () => {
    const program = E.gen(function* () {
      const fellowshipLogs = yield* FellowshipLogs;

      const first = yield* fellowshipLogs.queueDungeonRunImport(QUEUE_OPTIONS);
      const second = yield* fellowshipLogs.queueDungeonRunImport(QUEUE_OPTIONS);

      expect(first.wasAlreadyQueued).toBe(false);
      expect(first.job.status).toBe("QUEUED");
      expect(first.job.kind).toBe("ImportFellowshipLogsDungeonRun");
      expect(first.job.payload).toEqual(QUEUE_OPTIONS);
      expect(second.wasAlreadyQueued).toBe(true);
      expect(second.job.id).toBe(first.job.id);
    }).pipe(E.provide(makeTestLayer()));

    await runTest(program);
  });

  test("fails with AlreadyImported when the run was already imported", async () => {
    const program = E.gen(function* () {
      const fellowshipLogs = yield* FellowshipLogs;

      const importResult = yield* importRun;

      const error = yield* fellowshipLogs
        .queueDungeonRunImport(QUEUE_OPTIONS)
        .pipe(E.flip);

      expect(error._tag).toBe(
        "FellowshipLogsDungeonRunImportAlreadyImportedError",
      );
      expect(error).toMatchObject({
        dungeonRunId: importResult.dungeonRunId,
      });
    }).pipe(E.provide(makeTestLayer()));

    await runTest(program);
  });
});
