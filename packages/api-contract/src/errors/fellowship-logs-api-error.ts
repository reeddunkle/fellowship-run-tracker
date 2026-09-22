import * as Schema from "effect/Schema";

import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const FellowshipLogsApiRunFields = {
  fightId: FellowshipLogsFightIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
};

export class FellowshipLogsApiRunNotFoundError extends Schema.TaggedError<FellowshipLogsApiRunNotFoundError>()(
  "FellowshipLogsApiRunNotFoundError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 404 },
) {
  override get message() {
    return "We couldn't find that report and fight.";
  }
}

export class FellowshipLogsApiRunNotFinishedError extends Schema.TaggedError<FellowshipLogsApiRunNotFinishedError>()(
  "FellowshipLogsApiRunNotFinishedError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 409 },
) {
  override get message() {
    return "This run hasn't finished yet.";
  }
}

export class FellowshipLogsApiDungeonLevelNotFoundError extends Schema.TaggedError<FellowshipLogsApiDungeonLevelNotFoundError>()(
  "FellowshipLogsApiDungeonLevelNotFoundError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 422 },
) {
  override get message() {
    return "This run doesn't have a dungeon level, so it can't be imported.";
  }
}
