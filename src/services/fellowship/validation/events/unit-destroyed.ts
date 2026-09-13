import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { parseUnitId } from "@/services/fellowship/utilities/parse-unit-id.ts";
import { TimestampSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { JsonStringSchema } from "@/validation/common-schemas.ts";

const UnitDestroyedLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.UNIT_DESTROYED), // type
  Schema.String, // unitId
  JsonStringSchema, // unitName
  Schema.FiniteFromString, // unknown numeric value
]);

const UnitDestroyedEventSchema = Schema.Struct({
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.UNIT_DESTROYED),
  unitId: Schema.String,
  unitInstanceId: Schema.String,
  unitName: Schema.String,
  unitTypeId: Schema.String,
  unknownValue: Schema.Finite,
});

export const UnitDestroyedEventFromLogSchema = UnitDestroyedLogLineSchema.pipe(
  Schema.decodeTo(UnitDestroyedEventSchema, {
    decode: SchemaGetter.transform(
      ([timestamp, type, unitId, unitName, unknownValue]) => {
        const { unitInstanceId, unitTypeId } = parseUnitId(unitId);

        return {
          timestamp,
          type,
          unitId,
          unitInstanceId,
          unitName,
          unitTypeId,
          unknownValue,
        };
      },
    ),

    encode: SchemaGetter.transform((event) => {
      return [
        event.timestamp,
        event.type,
        event.unitId,
        event.unitName,
        event.unknownValue,
      ] as const;
    }),
  }),
);
