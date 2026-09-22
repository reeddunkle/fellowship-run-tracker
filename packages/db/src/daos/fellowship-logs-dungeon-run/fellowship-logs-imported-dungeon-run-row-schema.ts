import * as Schema from "effect/Schema";

import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

export const FellowshipLogsImportedDungeonRunRowSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  dungeonName: NonEmptyStringSchema,
  dungeonRunId: DungeonRunIdSchema,
  endedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  fightId: FellowshipLogsFightIdSchema,
  importedAt: Schema.DateTimeUtcFromMillis,
  reportCode: FellowshipLogsReportCodeSchema,
  startedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
});

export type FellowshipLogsImportedDungeonRunRow =
  typeof FellowshipLogsImportedDungeonRunRowSchema.Type;
