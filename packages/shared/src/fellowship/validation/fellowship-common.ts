import * as Schema from "effect/Schema";

import {
  IntegerFromStringSchema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const ETERNAL_DUNGEON_LEVEL_OFFSET = 20;
export const ADVENTURE_DUNGEON_LEVEL = 1;

export const DungeonCategorySchema = Schema.Literals(["ADVENTURE", "ETERNAL"]);

export type DungeonCategory = typeof DungeonCategorySchema.Type;

export const AdventureDifficultySchema = Schema.Literals([
  "EASY",
  "MEDIUM",
  "HARD",
]);

export type AdventureDifficulty = typeof AdventureDifficultySchema.Type;

export const AbsoluteDungeonLevelSchema = Schema.Finite.check(
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
): number {
  return absoluteDungeonLevel <= ETERNAL_DUNGEON_LEVEL_OFFSET
    ? absoluteDungeonLevel
    : absoluteDungeonLevel - ETERNAL_DUNGEON_LEVEL_OFFSET;
}

export function getDungeonCategoryFromAbsoluteDungeonLevel(
  absoluteDungeonLevel: number,
): DungeonCategory {
  return absoluteDungeonLevel <= ETERNAL_DUNGEON_LEVEL_OFFSET
    ? "ADVENTURE"
    : "ETERNAL";
}

export function getAdventureDifficultyFromLogId(
  difficultyId: number,
): AdventureDifficulty | undefined {
  return (
    {
      2: "EASY",
      3: "MEDIUM",
      4: "HARD",
    } as const
  )[difficultyId as 2 | 3 | 4];
}

export function getAdventureDifficultyLogId(
  difficulty: AdventureDifficulty | undefined,
): number {
  return difficulty === undefined
    ? 0
    : {
        EASY: 2,
        HARD: 4,
        MEDIUM: 3,
      }[difficulty];
}
