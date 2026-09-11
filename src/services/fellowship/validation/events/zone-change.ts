import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import {
  AbsoluteDungeonLevelFromLogSchema,
  AbsoluteDungeonLevelSchema,
  DungeonIdSchema,
  DungeonLevelSchema,
  DungeonNameSchema,
  getDungeonLevelFromAbsoluteDungeonLevel,
  TimestampSchema,
} from "@/services/fellowship/validation/fellowship-common.ts";
import {
  EmptyStringSchema,
  JsonStringSchema,
} from "@/validation/common-schemas.ts";

const ZoneChangeLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.ZONE_CHANGE), // type
  JsonStringSchema, // dungeonName
  Schema.String, // dungeonId
  AbsoluteDungeonLevelFromLogSchema, // absoluteDungeonLevel
  EmptyStringSchema, // unmappedEmptyString
]);

const ZoneChangeEventSchema = Schema.Struct({
  absoluteDungeonLevel: AbsoluteDungeonLevelSchema,
  dungeonId: DungeonIdSchema,
  dungeonLevel: Schema.UndefinedOr(DungeonLevelSchema),
  dungeonName: DungeonNameSchema,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.ZONE_CHANGE),
});

export const ZoneChangeEventFromLogSchema = ZoneChangeLogLineSchema.pipe(
  Schema.decodeTo(ZoneChangeEventSchema, {
    decode: SchemaGetter.transform(
      ([timestamp, type, dungeonName, dungeonId, absoluteDungeonLevel]) => {
        return {
          absoluteDungeonLevel,
          dungeonId,
          dungeonLevel:
            getDungeonLevelFromAbsoluteDungeonLevel(absoluteDungeonLevel),
          dungeonName,
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
        "",
      ] as const;
    }),
  }),
);
