import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test, vi } from "vitest";

import { type FellowshipLogsDungeonRunImporterShape } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { makeSimulatedFellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/make-simulated-fellowship-logs-dungeon-run-importer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  makeSimulatedImportReportCode,
  parseSimulatedImportReportCode,
  type SimulatedImportOutcome,
} from "@frt/shared/fellowship-logs/simulated-import-report-code.ts";

const toReportCode = Schema.decodeSync(FellowshipLogsReportCodeSchema);
const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(1);
const REAL_DUNGEON_RUN_ID = DungeonRunIdSchema.make("real-run");

function makeRealImporter() {
  const importReport = vi.fn<
    FellowshipLogsDungeonRunImporterShape["importReport"]
  >(() => {
    return E.succeed({ dungeonRunId: REAL_DUNGEON_RUN_ID });
  });

  return { importReport };
}

function simulatedReportCode(outcome: SimulatedImportOutcome) {
  return toReportCode(
    makeSimulatedImportReportCode({
      durationSeconds: 10,
      nonce: "n1",
      outcome,
    }),
  );
}

function runImport(
  importer: FellowshipLogsDungeonRunImporterShape,
  reportCode: ReturnType<typeof toReportCode>,
) {
  return E.gen(function* () {
    const progress: Array<number> = [];

    const fiber = yield* importer
      .importReport({
        fightId: FIGHT_ID,
        isOwnRun: true,
        onProgress: (fraction) => {
          return E.sync(() => {
            progress.push(fraction);
          });
        },
        reportCode,
      })
      .pipe(E.result, E.forkChild);

    yield* TestClock.adjust("20 seconds");

    const result = yield* Fiber.join(fiber);

    return { progress, result };
  });
}

describe("simulated import report codes", () => {
  test("round-trip the outcome and duration", async () => {
    const parsed = await runTest(
      parseSimulatedImportReportCode(simulatedReportCode("rate-limited")),
    );

    expect(parsed).toEqual(
      Option.some({ durationSeconds: 10, outcome: "rate-limited" }),
    );
  });

  test("don't match real report codes", async () => {
    const parsed = await runTest(
      parseSimulatedImportReportCode(toReportCode("XdfFZzgHBJNr6m3v")),
    );

    expect(Option.isNone(parsed)).toBe(true);
  });
});

describe("makeSimulatedFellowshipLogsDungeonRunImporter", () => {
  test("hands real report codes to the real importer", async () => {
    const realImporter = makeRealImporter();
    const importer =
      makeSimulatedFellowshipLogsDungeonRunImporter(realImporter);

    const { result } = await runTest(
      runImport(importer, toReportCode("XdfFZzgHBJNr6m3v")).pipe(
        E.provide(TestClock.layer()),
      ),
    );

    expect(realImporter.importReport).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      success: { dungeonRunId: REAL_DUNGEON_RUN_ID },
    });
  });

  test("reports progress and succeeds", async () => {
    const realImporter = makeRealImporter();
    const importer =
      makeSimulatedFellowshipLogsDungeonRunImporter(realImporter);

    const { progress, result } = await runTest(
      runImport(importer, simulatedReportCode("success")).pipe(
        E.provide(TestClock.layer()),
      ),
    );

    expect(realImporter.importReport).not.toHaveBeenCalled();
    expect(progress).toHaveLength(10);
    expect(progress.at(-1)).toBe(1);
    expect(result).toMatchObject({ _tag: "Success" });
  });

  test("fails partway through", async () => {
    const importer = makeSimulatedFellowshipLogsDungeonRunImporter(
      makeRealImporter(),
    );

    const { progress, result } = await runTest(
      runImport(importer, simulatedReportCode("failure")).pipe(
        E.provide(TestClock.layer()),
      ),
    );

    expect(progress).toHaveLength(6);
    expect(result).toMatchObject({
      failure: { _tag: "FellowshipLogsDungeonRunImportRunNotFoundError" },
    });
  });

  test("is rate limited once, then succeeds", async () => {
    const importer = makeSimulatedFellowshipLogsDungeonRunImporter(
      makeRealImporter(),
    );
    const reportCode = simulatedReportCode("rate-limited");

    const [first, second] = await runTest(
      E.all([
        runImport(importer, reportCode),
        runImport(importer, reportCode),
      ]).pipe(E.provide(TestClock.layer())),
    );

    expect(first.result).toMatchObject({
      failure: { _tag: "FellowshipLogsGatewayRateLimitExceededError" },
    });
    expect(second.result).toMatchObject({ _tag: "Success" });
  });
});
