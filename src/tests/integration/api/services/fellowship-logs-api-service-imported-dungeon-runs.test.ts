import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsApiService } from "@/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { makeFellowshipLogsDungeonRunImporterIntegrationTestHarness } from "@/tests/common/harnesses/fellowship-logs-dungeon-run-importer-integration-test-harness.ts";
import { runTest } from "@/tests/common/run-test.ts";
import { FellowshipLogsFightIdSchema } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

describe("FellowshipLogsApiService imported dungeon runs", () => {
  test("lists and deletes an imported run", async () => {
    const harness =
      makeFellowshipLogsDungeonRunImporterIntegrationTestHarness();

    const FellowshipLogsApiServiceTestLive =
      FellowshipLogsApiService.layerNoDeps.pipe(Layer.provide(harness.layer));

    const TestLive = Layer.merge(
      harness.layer,
      FellowshipLogsApiServiceTestLive,
    );

    const program = E.gen(function* () {
      const fellowshipLogsApiService = yield* FellowshipLogsApiService;

      const importResult = yield* fellowshipLogsApiService.importDungeonRun({
        fightId: FIGHT_ID,
        isOwnRun: false,
        reportCode: REPORT_CODE,
      });

      const importedRuns =
        yield* fellowshipLogsApiService.getImportedDungeonRuns();

      expect(importedRuns).toHaveLength(1);
      expect(importedRuns[0]?.dungeonRunId).toBe(importResult.dungeonRunId);
      expect(importedRuns[0]?.reportCode).toBe(REPORT_CODE);
      expect(importedRuns[0]?.fightId).toBe(FIGHT_ID);

      yield* fellowshipLogsApiService.deleteImportedDungeonRun({
        dungeonRunId: importResult.dungeonRunId,
      });

      const importedRunsAfterDelete =
        yield* fellowshipLogsApiService.getImportedDungeonRuns();

      expect(importedRunsAfterDelete).toHaveLength(0);
    }).pipe(E.provide(TestLive));

    await runTest(program);
  });

  test("fails with RunNotFound when deleting a run that does not exist", async () => {
    const harness =
      makeFellowshipLogsDungeonRunImporterIntegrationTestHarness();

    const FellowshipLogsApiServiceTestLive =
      FellowshipLogsApiService.layerNoDeps.pipe(Layer.provide(harness.layer));

    const TestLive = Layer.merge(
      harness.layer,
      FellowshipLogsApiServiceTestLive,
    );

    const program = E.gen(function* () {
      const fellowshipLogsApiService = yield* FellowshipLogsApiService;

      const importResult = yield* fellowshipLogsApiService.importDungeonRun({
        fightId: FIGHT_ID,
        isOwnRun: false,
        reportCode: REPORT_CODE,
      });

      yield* fellowshipLogsApiService.deleteImportedDungeonRun({
        dungeonRunId: importResult.dungeonRunId,
      });

      const result = yield* fellowshipLogsApiService
        .deleteImportedDungeonRun({
          dungeonRunId: importResult.dungeonRunId,
        })
        .pipe(E.flip);

      expect(result.details._tag).toBe("RunNotFound");
    }).pipe(E.provide(TestLive));

    await runTest(program);
  });
});
