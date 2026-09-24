import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { DungeonRunApiService } from "@frt/api/services/api/dungeon-run/dungeon-run-api-service.ts";
import { makeFellowshipLogsDungeonRunImporterIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-logs-dungeon-run-importer-integration-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

describe("DungeonRunApiService with Fellowship Logs import", () => {
  test("returns history created from imported Fellowship Logs observations", async () => {
    const harness =
      makeFellowshipLogsDungeonRunImporterIntegrationTestHarness();

    const DungeonRunApiServiceTestLive = DungeonRunApiService.layer.pipe(
      Layer.provide(harness.layer),
    );

    const TestLive = Layer.merge(harness.layer, DungeonRunApiServiceTestLive);

    const program = E.gen(function* () {
      const fellowshipLogsDungeonRunImporter =
        yield* FellowshipLogsDungeonRunImporter;
      const dungeonRunApiService = yield* DungeonRunApiService;
      const sql = yield* MainDatabase;

      const importResult = yield* fellowshipLogsDungeonRunImporter.importReport(
        {
          fightId: FIGHT_ID,
          isOwnRun: true,
          reportCode: REPORT_CODE,
        },
      );

      const dungeonRunRows = yield* sql<{
        readonly dungeonId: string;
        readonly dungeonLevel: number;
      }>`
        SELECT
          dungeon_id,
          dungeon_level
        FROM
          dungeon_run
        WHERE
          id = ${importResult.dungeonRunId}
      `;

      expect(dungeonRunRows).toHaveLength(1);

      const [dungeonRun] = dungeonRunRows;

      if (dungeonRun === undefined) {
        return yield* E.die("Expected imported dungeon run.");
      }

      const dungeonId = yield* Schema.decodeEffect(DungeonIdSchema)(
        dungeonRun.dungeonId,
      );

      const result = yield* dungeonRunApiService.getHistory({
        dungeonId,
        dungeonLevel: dungeonRun.dungeonLevel,
      });

      expect(result.observations.length).toBeGreaterThan(0);

      for (const observation of result.observations) {
        expect(observation.sampleCount).toBeGreaterThan(0);
      }
    }).pipe(E.provide(TestLive));

    await runTest(program);
  });
});
