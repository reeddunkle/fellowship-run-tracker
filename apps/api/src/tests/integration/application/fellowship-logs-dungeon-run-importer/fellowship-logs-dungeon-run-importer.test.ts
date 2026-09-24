import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { makeFellowshipLogsDungeonRunImporterIntegrationTestHarness } from "@frt/api/tests/common/harnesses/fellowship-logs-dungeon-run-importer-integration-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

describe("FellowshipLogsDungeonRunImporter", () => {
  test("reports progress as report pages are fetched", async () => {
    const reported: Array<number> = [];

    await E.gen(function* () {
      const fellowshipLogsDungeonRunImporter =
        yield* FellowshipLogsDungeonRunImporter;

      yield* fellowshipLogsDungeonRunImporter.importReport({
        fightId: FIGHT_ID,
        isOwnRun: true,
        onProgress: (fraction) => {
          return E.sync(() => {
            reported.push(fraction);
          });
        },
        reportCode: REPORT_CODE,
      });
    }).pipe(
      E.provide(
        makeFellowshipLogsDungeonRunImporterIntegrationTestHarness().layer,
      ),
      runTest,
    );

    const isNonDecreasing = reported.every((fraction, index) => {
      return index === 0 || fraction >= (reported[index - 1] ?? 0);
    });

    expect(reported.length).toBeGreaterThan(1);
    expect(isNonDecreasing).toBe(true);
    expect(reported.at(-1)).toBe(1);
  });

  test("imports a Fellowship Logs dungeon run and its observations", async () => {
    await E.gen(function* () {
      const harness =
        makeFellowshipLogsDungeonRunImporterIntegrationTestHarness();

      yield* E.gen(function* () {
        const fellowshipLogsDungeonRunImporter =
          yield* FellowshipLogsDungeonRunImporter;
        const sql = yield* MainDatabase;

        const result = yield* fellowshipLogsDungeonRunImporter.importReport({
          fightId: FIGHT_ID,
          isOwnRun: true,
          reportCode: REPORT_CODE,
        });

        const dungeonRunRows = yield* sql<{
          readonly dungeon_id: string;
          readonly dungeon_level: number;
          readonly ended_at: string;
          readonly id: string;
          readonly isOwnRun: number;
          readonly source: string;
          readonly started_at: string;
        }>`
          SELECT
            id,
            dungeon_id,
            dungeon_level,
            started_at,
            ended_at,
            source,
            is_own_run
          FROM
            dungeon_run
          WHERE
            id = ${result.dungeonRunId}
        `;

        expect(dungeonRunRows).toHaveLength(1);

        const dungeonRun = dungeonRunRows[0];

        expect(dungeonRun).toBeDefined();
        expect(dungeonRun?.id).toBe(result.dungeonRunId);
        expect(dungeonRun?.source).toBe("FELLOWSHIP_LOGS");
        expect(dungeonRun?.isOwnRun).toBe(1);
        expect(dungeonRun?.started_at).not.toBeNull();
        expect(dungeonRun?.ended_at).not.toBeNull();

        const fellowshipLogsDungeonRunRows = yield* sql<{
          readonly dungeonRunId: string;
          readonly fightId: number;
          readonly reportCode: string;
        }>`
          SELECT
            dungeon_run_id,
            report_code,
            fight_id
          FROM
            fellowship_logs_dungeon_run
          WHERE
            dungeon_run_id = ${result.dungeonRunId}
        `;

        expect(fellowshipLogsDungeonRunRows).toEqual([
          expect.objectContaining({
            dungeonRunId: result.dungeonRunId,
            fightId: FIGHT_ID,
            reportCode: REPORT_CODE,
          }),
        ]);

        const observationRows = yield* sql<{
          readonly dungeonRunId: string;
        }>`
          SELECT
            dungeon_run_id
          FROM
            dungeon_run_observation
          WHERE
            dungeon_run_id = ${result.dungeonRunId}
        `;

        expect(observationRows.length).toBeGreaterThan(0);

        for (const observation of observationRows) {
          expect(observation.dungeonRunId).toBe(result.dungeonRunId);
        }
      }).pipe(E.provide(harness.layer));
    }).pipe(runTest);
  });
});
