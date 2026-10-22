import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import {
  AbsoluteDungeonLevelFromLogSchema,
  AbsoluteDungeonLevelSchema,
  AdventureDifficultySchema,
  DungeonAffixIdsSchema,
  DungeonCategorySchema,
  DungeonIdSchema,
  DungeonLevelSchema,
  DungeonNameSchema,
  getAdventureDifficultyFromLogId,
  getAdventureDifficultyLogId,
  getDungeonCategoryFromAbsoluteDungeonLevel,
  getDungeonLevelFromAbsoluteDungeonLevel,
  TimestampSchema,
} from "@frt/shared/fellowship/validation/fellowship-common.ts";
import {
  EmptyStringSchema,
  IntegerFromStringSchema,
  JsonIntegerArraySchema,
  JsonStringSchema,
} from "@frt/shared/util/common-schemas.ts";

const DungeonStartLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_START), // type
  JsonStringSchema, // dungeonName
  Schema.String, // dungeonId
  AbsoluteDungeonLevelFromLogSchema, // absoluteDungeonLevel
  JsonIntegerArraySchema, // affixIds
  IntegerFromStringSchema,
  Schema.DateTimeUtcFromString, // startedAt
  EmptyStringSchema, // unmappedEmptyString
]);

const DungeonStartEventSchema = Schema.Struct({
  absoluteDungeonLevel: AbsoluteDungeonLevelSchema,
  adventureDifficulty: Schema.UndefinedOr(AdventureDifficultySchema),
  affixIds: DungeonAffixIdsSchema,
  dungeonCategory: DungeonCategorySchema,
  dungeonId: DungeonIdSchema,
  dungeonLevel: Schema.UndefinedOr(DungeonLevelSchema),
  dungeonName: DungeonNameSchema,
  startedAt: TimestampSchema,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_START),
});

export const DungeonStartEventFromLogSchema = DungeonStartLogLineSchema.pipe(
  Schema.decodeTo(DungeonStartEventSchema, {
    decode: SchemaGetter.transform(
      ([
        timestamp,
        type,
        dungeonName,
        dungeonId,
        absoluteDungeonLevel,
        affixIds,
        adventureDifficultyId,
        startedAt,
      ]) => {
        return {
          absoluteDungeonLevel,
          adventureDifficulty: getAdventureDifficultyFromLogId(
            adventureDifficultyId,
          ),
          affixIds: affixIds.map(String),
          dungeonCategory:
            getDungeonCategoryFromAbsoluteDungeonLevel(absoluteDungeonLevel),
          dungeonId,
          dungeonLevel:
            getDungeonLevelFromAbsoluteDungeonLevel(absoluteDungeonLevel),
          dungeonName,
          startedAt,
          timestamp,
          type,
        };
      },
    ),
    encode: SchemaGetter.transform((event) => {
      return [
        event.timestamp,
        event.type,
        event.dungeonName,
        event.dungeonId,
        event.absoluteDungeonLevel,
        event.affixIds.map(Number),
        getAdventureDifficultyLogId(event.adventureDifficulty),
        event.startedAt,
        "",
      ] as const;
    }),
  }),
);

export type DungeonStartEvent = typeof DungeonStartEventFromLogSchema.Type;
