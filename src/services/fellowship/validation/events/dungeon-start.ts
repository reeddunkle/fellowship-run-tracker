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
  EmptyStringSchema,
  JsonIntegerArraySchema,
  JsonStringSchema,
} from "@/validation/common-schemas.ts";

const DungeonStartLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_START), // type
  JsonStringSchema, // dungeonName
  Schema.String, // dungeonId
  AbsoluteDungeonLevelFromLogSchema, // absoluteDungeonLevel
  JsonIntegerArraySchema, // affixIds
  BooleanFlagSchema, // unmappedFlag
  Schema.DateTimeUtcFromString, // startedAt
  EmptyStringSchema, // unmappedEmptyString
]);

const DungeonStartEventSchema = Schema.Struct({
  absoluteDungeonLevel: AbsoluteDungeonLevelSchema,
  affixIds: DungeonAffixIdsSchema,
  dungeonId: DungeonIdSchema,
  dungeonLevel: Schema.UndefinedOr(DungeonLevelSchema),
  dungeonName: DungeonNameSchema,
  startedAt: TimestampSchema,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_START),
  unmappedFlag: Schema.Boolean,
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
        unmappedFlag,
        startedAt,
      ]) => {
        return {
          absoluteDungeonLevel,
          affixIds: affixIds.map(String),
          dungeonId,
          dungeonLevel:
            getDungeonLevelFromAbsoluteDungeonLevel(absoluteDungeonLevel),
          dungeonName,
          startedAt,
          timestamp,
          type,
          unmappedFlag,
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
        event.unmappedFlag,
        event.startedAt,
        "",
      ] as const;
    }),
  }),
);

export type DungeonStartEvent = typeof DungeonStartEventFromLogSchema.Type;
