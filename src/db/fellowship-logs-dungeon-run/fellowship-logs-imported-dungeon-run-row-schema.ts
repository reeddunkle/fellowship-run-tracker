import * as Schema from "effect/Schema";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

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
