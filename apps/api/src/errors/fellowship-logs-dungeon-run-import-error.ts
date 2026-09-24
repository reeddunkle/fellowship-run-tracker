import * as Data from "effect/Data";

import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

export class FellowshipLogsDungeonRunImportRunNotFoundError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportRunNotFoundError",
)<{
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
}> {
  override get message() {
    return `No dungeon run found in report ${this.reportCode}, fight ${this.fightId}.`;
  }
}

export class FellowshipLogsDungeonRunImportRunNotFinishedError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportRunNotFinishedError",
)<{
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
}> {
  override get message() {
    return `The dungeon run in report ${this.reportCode}, fight ${this.fightId}, hasn't finished.`;
  }
}

export class FellowshipLogsDungeonRunImportDungeonLevelNotFoundError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportDungeonLevelNotFoundError",
)<{
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
}> {
  override get message() {
    return `The dungeon run in report ${this.reportCode}, fight ${this.fightId}, has no dungeon level.`;
  }
}

export class FellowshipLogsDungeonRunImportAlreadyImportedError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportAlreadyImportedError",
)<{
  readonly dungeonRunId: DungeonRunId;
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
}> {
  override get message() {
    return `The dungeon run in report ${this.reportCode}, fight ${this.fightId}, has already been imported.`;
  }
}
