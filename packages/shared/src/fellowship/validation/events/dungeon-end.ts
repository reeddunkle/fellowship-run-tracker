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
  BooleanFlagSchema,
  IntegerFromStringSchema,
  JsonIntegerArraySchema,
  JsonStringSchema,
} from "@frt/shared/util/common-schemas.ts";

const DungeonEndLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_END), // type
  JsonStringSchema, // dungeonName
  Schema.String, // dungeonId
  AbsoluteDungeonLevelFromLogSchema, // absoluteDungeonLevel
  JsonIntegerArraySchema, // affixIds
  BooleanFlagSchema, // succeeded
  IntegerFromStringSchema, // numericField1
  Schema.FiniteFromString, // numericField2
  BooleanFlagSchema, // flag1
  IntegerFromStringSchema,
  BooleanFlagSchema, // flag3
]);

const DungeonEndUnmappedSchema = Schema.Struct({
  flag1: Schema.Boolean,
  flag3: Schema.Boolean,
  numericField1: Schema.Int,
  numericField2: Schema.Finite,
});

const DungeonEndEventSchema = Schema.Struct({
  absoluteDungeonLevel: AbsoluteDungeonLevelSchema,
  adventureDifficulty: Schema.UndefinedOr(AdventureDifficultySchema),
  affixIds: DungeonAffixIdsSchema,
  dungeonCategory: DungeonCategorySchema,
  dungeonId: DungeonIdSchema,
  dungeonLevel: Schema.UndefinedOr(DungeonLevelSchema),
  dungeonName: DungeonNameSchema,
  succeeded: Schema.Boolean,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_END),
  unmapped: DungeonEndUnmappedSchema,
});

export const DungeonEndEventFromLogSchema = DungeonEndLogLineSchema.pipe(
  Schema.decodeTo(DungeonEndEventSchema, {
    decode: SchemaGetter.transform(
      ([
        timestamp,
        type,
        dungeonName,
        dungeonId,
        absoluteDungeonLevel,
        affixIds,
        succeeded,
        numericField1,
        numericField2,
        flag1,
        adventureDifficultyId,
        flag3,
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
          succeeded,
          timestamp,
          type,
          unmapped: {
            flag1,
            flag3,
            numericField1,
            numericField2,
          },
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
        event.succeeded,
        event.unmapped.numericField1,
        event.unmapped.numericField2,
        event.unmapped.flag1,
        getAdventureDifficultyLogId(event.adventureDifficulty),
        event.unmapped.flag3,
      ] as const;
    }),
  }),
);

export type DungeonEndEvent = typeof DungeonEndEventFromLogSchema.Type;
