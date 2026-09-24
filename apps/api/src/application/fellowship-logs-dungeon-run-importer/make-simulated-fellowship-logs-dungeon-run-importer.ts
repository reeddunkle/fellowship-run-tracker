import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

import { FellowshipLogsDungeonRunImportRunNotFoundError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { FellowshipLogsRateLimitExceededError } from "@frt/api/errors/fellowship-logs-error.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  parseSimulatedImportReportCode,
  type SimulatedImport,
} from "@frt/shared/fellowship-logs/simulated-import-report-code.ts";

import { type FellowshipLogsDungeonRunImporterServiceShape } from "./fellowship-logs-dungeon-run-importer-service.ts";

const PROGRESS_STEPS = 10;
const FAILURE_STEP = 6;
const RATE_LIMITED_STEP = 3;
const RATE_LIMIT_RESET_DURATION = Duration.seconds(15);

type ImportReportOptions = Parameters<
  FellowshipLogsDungeonRunImporterServiceShape["importReport"]
>[0];

export function makeSimulatedFellowshipLogsDungeonRunImporter(
  realImporter: FellowshipLogsDungeonRunImporterServiceShape,
): FellowshipLogsDungeonRunImporterServiceShape {
  const deferredReportCodes = new Set<FellowshipLogsReportCode>();

  const runSteps = E.fn("SimulatedFellowshipLogsDungeonRunImporter.runSteps")(
    function* (
      { durationSeconds }: SimulatedImport,
      { onProgress }: ImportReportOptions,
      stepCount: number,
    ) {
      const stepDuration = Duration.divideUnsafe(
        Duration.seconds(durationSeconds),
        PROGRESS_STEPS,
      );

      yield* E.forEach(
        Array.from({ length: stepCount }, (_, index) => {
          return (index + 1) / PROGRESS_STEPS;
        }),
        (fraction) => {
          return E.sleep(stepDuration).pipe(
            E.andThen(onProgress === undefined ? E.void : onProgress(fraction)),
          );
        },
        { discard: true },
      );
    },
  );

  const simulateImport = E.fn(
    "SimulatedFellowshipLogsDungeonRunImporter.simulateImport",
  )(function* (simulated: SimulatedImport, options: ImportReportOptions) {
    const { fightId, reportCode } = options;

    const succeed = runSteps(simulated, options, PROGRESS_STEPS).pipe(
      E.as({
        dungeonRunId: DungeonRunIdSchema.make(`simulated-${reportCode}`),
      }),
    );

    return yield* Match.value(simulated.outcome).pipe(
      Match.when("success", () => {
        return succeed;
      }),
      Match.when("failure", () => {
        return runSteps(simulated, options, FAILURE_STEP).pipe(
          E.andThen(
            E.fail(
              new FellowshipLogsDungeonRunImportRunNotFoundError({
                fightId,
                reportCode,
              }),
            ),
          ),
        );
      }),
      Match.when("rate-limited", () => {
        if (deferredReportCodes.has(reportCode)) {
          return succeed;
        }

        return runSteps(simulated, options, RATE_LIMITED_STEP).pipe(
          E.andThen(DateTime.now),
          E.flatMap((now) => {
            deferredReportCodes.add(reportCode);

            return E.fail(
              new FellowshipLogsRateLimitExceededError({
                reason: "PreflightExhausted",
                resetsAt: DateTime.addDuration(now, RATE_LIMIT_RESET_DURATION),
              }),
            );
          }),
        );
      }),
      Match.exhaustive,
    );
  });

  const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
    E.fn("SimulatedFellowshipLogsDungeonRunImporter.importReport")(
      function* (options) {
        const simulated = yield* parseSimulatedImportReportCode(
          options.reportCode,
        );

        if (Option.isNone(simulated)) {
          return yield* realImporter.importReport(options);
        }

        yield* E.logInfo("Simulating a Fellowship Logs import.", {
          durationSeconds: simulated.value.durationSeconds,
          outcome: simulated.value.outcome,
          reportCode: options.reportCode,
        });

        return yield* simulateImport(simulated.value, options);
      },
    );

  return {
    importReport,
  };
}
