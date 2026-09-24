import * as Schema from "effect/Schema";

import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

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

export class FellowshipLogsApiAlreadyImportedError extends Schema.TaggedError<FellowshipLogsApiAlreadyImportedError>()(
  "FellowshipLogsApiAlreadyImportedError",
  {
    ...FellowshipLogsApiRunFields,
    dungeonRunId: DungeonRunIdSchema,
  },
  { httpApiStatus: 409 },
) {
  override get message() {
    return "This run has already been imported.";
  }
}

export class FellowshipLogsApiRateLimitExceededError extends Schema.TaggedError<FellowshipLogsApiRateLimitExceededError>()(
  "FellowshipLogsApiRateLimitExceededError",
  {
    resetsAtMilliseconds: NonNegativeIntegerSchema,
  },
  { httpApiStatus: 429 },
) {
  override get message() {
    return "You've used all your Fellowship Logs points for this hour.";
  }
}
