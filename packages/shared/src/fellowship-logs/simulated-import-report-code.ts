import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { PositiveIntegerFromStringSchema } from "@frt/shared/util/common-schemas.ts";

const SimulatedImportOutcomeSchema = Schema.Literals([
  "failure",
  "rate-limited",
  "success",
]);

export type SimulatedImportOutcome = typeof SimulatedImportOutcomeSchema.Type;

const SimulatedImportReportCodeSchema = Schema.TemplateLiteralParser([
  "SIMULATED-",
  SimulatedImportOutcomeSchema,
  "-",
  PositiveIntegerFromStringSchema,
  "s-",
  Schema.String,
]);

export type SimulatedImport = {
  readonly durationSeconds: number;
  readonly outcome: SimulatedImportOutcome;
};

export function makeSimulatedImportReportCode({
  durationSeconds,
  nonce,
  outcome,
}: SimulatedImport & { readonly nonce: string }): string {
  return `SIMULATED-${outcome}-${durationSeconds}s-${nonce}`;
}

export function parseSimulatedImportReportCode(
  reportCode: FellowshipLogsReportCode,
): E.Effect<Option.Option<SimulatedImport>> {
  return Schema.decodeUnknownEffect(SimulatedImportReportCodeSchema)(
    reportCode,
  ).pipe(
    E.option,
    E.map(
      Option.map(([, outcome, , durationSeconds]): SimulatedImport => {
        return { durationSeconds, outcome };
      }),
    ),
  );
}
