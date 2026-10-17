// @effect-diagnostics-next-line nodeBuiltinImport:off
import nodePath from "node:path";

import type * as Path from "effect/Path";

import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

type FellowshipLogsGatewayFixtureFight = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

// [KEEP] Read while modules load, before any Effect runtime (and `Config`) exists.
// @effect-diagnostics-next-line processEnv:off
const fixtureDirectoryOverride = process.env.FELLOWSHIP_LOGS_FIXTURE_DIRECTORY;

export const FELLOWSHIP_LOGS_FIXTURE_DIRECTORY =
  fixtureDirectoryOverride === undefined || fixtureDirectoryOverride === ""
    ? nodePath.join(import.meta.dirname, "../../../fixtures/fellowship-logs")
    : nodePath.resolve(fixtureDirectoryOverride);

export function getFellowshipLogsGatewayReportFixtureDirectoryPrefix(
  reportCode: string,
) {
  return `${reportCode}-fights-`;
}

function getFellowshipLogsGatewayFixtureDirectoryName({
  fightId,
  reportCode,
}: FellowshipLogsGatewayFixtureFight) {
  return `${getFellowshipLogsGatewayReportFixtureDirectoryPrefix(reportCode)}${fightId}`;
}

export function getFellowshipLogsGatewayReportFixtureDirectory({
  fixtureDirectory,
  options,
  path,
}: {
  readonly fixtureDirectory: string;
  readonly options: FellowshipLogsGatewayFixtureFight;
  readonly path: Path.Path;
}) {
  return path.resolve(
    fixtureDirectory,
    getFellowshipLogsGatewayFixtureDirectoryName(options),
  );
}
