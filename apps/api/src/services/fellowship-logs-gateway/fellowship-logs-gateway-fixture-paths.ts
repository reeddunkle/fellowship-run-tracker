// @effect-diagnostics-next-line nodeBuiltinImport:off
import nodePath from "node:path";

import type * as Path from "effect/Path";

import { type GetFellowshipLogsGatewayReportOptions } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";

// [KEEP] Read while modules load, before any Effect runtime (and `Config`) exists.
// @effect-diagnostics-next-line processEnv:off
const fixtureDirectoryOverride = process.env.FELLOWSHIP_LOGS_FIXTURE_DIRECTORY;

export const FELLOWSHIP_LOGS_FIXTURE_DIRECTORY =
  fixtureDirectoryOverride === undefined || fixtureDirectoryOverride === ""
    ? nodePath.join(import.meta.dirname, "../../../fixtures/fellowship-logs")
    : nodePath.resolve(fixtureDirectoryOverride);

function getFellowshipLogsGatewayFixtureDirectoryName({
  fightId,
  reportCode,
}: GetFellowshipLogsGatewayReportOptions) {
  return `${reportCode}-fights-${fightId}`;
}

export function getFellowshipLogsGatewayReportFixtureDirectory({
  fixtureDirectory,
  options,
  path,
}: {
  readonly fixtureDirectory: string;
  readonly options: GetFellowshipLogsGatewayReportOptions;
  readonly path: Path.Path;
}) {
  return path.resolve(
    fixtureDirectory,
    getFellowshipLogsGatewayFixtureDirectoryName(options),
  );
}
