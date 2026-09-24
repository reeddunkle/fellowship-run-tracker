// @effect-diagnostics-next-line nodeBuiltinImport:off
import nodePath from "node:path";

import type * as Path from "effect/Path";

import { type GetFellowshipLogsReportOptions } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";

// [KEEP] Read while modules load, before any Effect runtime (and `Config`) exists.
// @effect-diagnostics-next-line processEnv:off
const fixtureDirectoryOverride = process.env.FELLOWSHIP_LOGS_FIXTURE_DIRECTORY;

export const FELLOWSHIP_LOGS_FIXTURE_DIRECTORY =
  fixtureDirectoryOverride === undefined || fixtureDirectoryOverride === ""
    ? nodePath.join(import.meta.dirname, "../../../fixtures/fellowship-logs")
    : nodePath.resolve(fixtureDirectoryOverride);

function getFellowshipLogsFixtureDirectoryName({
  fightId,
  reportCode,
}: GetFellowshipLogsReportOptions) {
  return `${reportCode}-fights-${fightId}`;
}

export function getFellowshipLogsReportFixtureDirectory({
  fixtureDirectory,
  options,
  path,
}: {
  readonly fixtureDirectory: string;
  readonly options: GetFellowshipLogsReportOptions;
  readonly path: Path.Path;
}) {
  return path.resolve(
    fixtureDirectory,
    getFellowshipLogsFixtureDirectoryName(options),
  );
}
