import * as Schema from "effect/Schema";

import { type ImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

export function makeImportJob(
  id: string,
  status: ImportFellowshipLogsDungeonRunBackgroundJobApiItem["status"],
  overrides: Partial<ImportFellowshipLogsDungeonRunBackgroundJobApiItem> = {},
): ImportFellowshipLogsDungeonRunBackgroundJobApiItem {
  return {
    attempts: 0,
    availableAtMilliseconds: status === "WAITING" ? 60_000 : null,
    createdAtMilliseconds: 0,
    error: null,
    finishedAtMilliseconds: null,
    id: Schema.decodeSync(BackgroundJobIdSchema)(id),
    kind: "ImportFellowshipLogsDungeonRun",
    payload: {
      dungeonId: "100006",
      dungeonLevel: 12,
      fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
      isOwnRun: true,
      reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
        "XdfFZzgHBJNr6m3v",
      ),
    },
    progress: null,
    result: null,
    startedAtMilliseconds: null,
    status,
    ...overrides,
  };
}
