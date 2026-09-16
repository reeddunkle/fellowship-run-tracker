import type * as Path from "effect/Path";

import { type GetFellowshipLogsReportOptions } from "@/services/fellowship-logs/fellowship-logs-service.ts";

export const FELLOWSHIP_LOGS_FIXTURE_DIRECTORY = "./fixtures/fellowship-logs";

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
