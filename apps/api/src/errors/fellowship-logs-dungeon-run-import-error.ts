import * as Data from "effect/Data";

import { type FellowshipLogsFightId } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

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
