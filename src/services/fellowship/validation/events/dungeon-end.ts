import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import {
  AbsoluteDungeonLevelFromLogSchema,
  AbsoluteDungeonLevelSchema,
  DungeonAffixIdsSchema,
  DungeonIdSchema,
  DungeonLevelSchema,
  DungeonNameSchema,
  getDungeonLevelFromAbsoluteDungeonLevel,
  TimestampSchema,
} from "@/services/fellowship/validation/fellowship-common.ts";
import {
  BooleanFlagSchema,
  IntegerFromStringSchema,
  JsonIntegerArraySchema,
  JsonStringSchema,
} from "@/validation/common-schemas.ts";

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
  BooleanFlagSchema, // flag2
  BooleanFlagSchema, // flag3
]);

const DungeonEndUnmappedSchema = Schema.Struct({
  flag1: Schema.Boolean,
  flag2: Schema.Boolean,
  flag3: Schema.Boolean,
  numericField1: Schema.Int,
  numericField2: Schema.Finite,
});

const DungeonEndEventSchema = Schema.Struct({
  absoluteDungeonLevel: AbsoluteDungeonLevelSchema,
  affixIds: DungeonAffixIdsSchema,
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
        flag2,
        flag3,
      ]) => {
        return {
          absoluteDungeonLevel,
          affixIds: affixIds.map(String),
          dungeonId,
          dungeonLevel:
            getDungeonLevelFromAbsoluteDungeonLevel(absoluteDungeonLevel),
          dungeonName,
          succeeded,
          timestamp,
          type,
          unmapped: {
            flag1,
            flag2,
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
        event.unmapped.flag2,
        event.unmapped.flag3,
      ] as const;
    }),
  }),
);

export type DungeonEndEvent = typeof DungeonEndEventFromLogSchema.Type;
