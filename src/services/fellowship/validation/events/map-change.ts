import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { TimestampSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { JsonStringSchema } from "@/validation/common-schemas.ts";

const MapChangeLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.MAP_CHANGE), // type
  Schema.String, // mapId
  JsonStringSchema, // mapName
  Schema.FiniteFromString, // numericField1
  Schema.FiniteFromString, // numericField2
  Schema.FiniteFromString, // numericField3
  Schema.FiniteFromString, // numericField4
]);

const MapChangeEventSchema = Schema.Struct({
  mapId: Schema.String,
  mapName: Schema.String,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.MAP_CHANGE),
  unmapped: Schema.Struct({
    numericField1: Schema.Finite,
    numericField2: Schema.Finite,
    numericField3: Schema.Finite,
    numericField4: Schema.Finite,
  }),
});

export const MapChangeEventFromLogSchema = MapChangeLogLineSchema.pipe(
  Schema.decodeTo(MapChangeEventSchema, {
    decode: SchemaGetter.transform(
      ([
        timestamp,
        type,
        mapId,
        mapName,
        numericField1,
        numericField2,
        numericField3,
        numericField4,
      ]) => {
        return {
          mapId,
          mapName,
          timestamp,
          type,
          unmapped: {
            numericField1,
            numericField2,
            numericField3,
            numericField4,
          },
        };
      },
    ),

    encode: SchemaGetter.transform((event) => {
      return [
        event.timestamp,
        event.type,
        event.mapId,
        event.mapName,
        event.unmapped.numericField1,
        event.unmapped.numericField2,
        event.unmapped.numericField3,
        event.unmapped.numericField4,
      ] as const;
    }),
  }),
);
