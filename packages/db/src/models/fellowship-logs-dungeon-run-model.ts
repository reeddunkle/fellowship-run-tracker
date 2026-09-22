import * as Model from "effect/unstable/schema/Model";

import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

export class FellowshipLogsDungeonRunModel extends Model.Class<FellowshipLogsDungeonRunModel>(
  "FellowshipLogsDungeonRunModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonRunId: DungeonRunIdSchema,
  fightId: FellowshipLogsFightIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
}) {}
