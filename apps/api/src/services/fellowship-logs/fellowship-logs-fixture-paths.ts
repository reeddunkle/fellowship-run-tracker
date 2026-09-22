// @effect-diagnostics-next-line nodeBuiltinImport:off
import nodePath from "node:path";

import type * as Path from "effect/Path";

import { type GetFellowshipLogsReportOptions } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";

// Read while modules load, before any Effect runtime (and `Config`) exists.
// @effect-diagnostics-next-line processEnv:off
const fixtureDirectoryOverride = process.env.FELLOWSHIP_LOGS_FIXTURE_DIRECTORY;

/**
 * `FELLOWSHIP_LOGS_FIXTURE_DIRECTORY` when set (relative paths resolve against
 * the directory the process started in), otherwise this package's
 * `fixtures/fellowship-logs`. The default only holds when this file runs from
 * source (tsx, vitest): bundled into the Electron main process, this module
 * no longer sits in the api package, so the dev `.env` sets it.
 */
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
