import * as Schema from "effect/Schema";

import {
  IntegerFromStringSchema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";

const ETERNAL_DUNGEON_LEVEL_OFFSET = 20;

export const AbsoluteDungeonLevelSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

export const AbsoluteDungeonLevelFromLogSchema = IntegerFromStringSchema.pipe(
  Schema.decodeTo(AbsoluteDungeonLevelSchema),
);

export const DungeonIdSchema = NonEmptyStringSchema;

export type DungeonId = typeof DungeonIdSchema.Type;

export const DungeonAffixIdsSchema = Schema.Array(Schema.String);
export const DungeonLevelSchema = PositiveIntegerSchema;
export const DungeonNameSchema = Schema.String;
export const EncounterIdSchema = Schema.String;
export const TimestampSchema = Schema.DateTimeUtc;

export function getDungeonLevelFromAbsoluteDungeonLevel(
  absoluteDungeonLevel: number,
): number | undefined {
  const dungeonLevel = absoluteDungeonLevel - ETERNAL_DUNGEON_LEVEL_OFFSET;

  return dungeonLevel >= 1 ? dungeonLevel : undefined;
}
