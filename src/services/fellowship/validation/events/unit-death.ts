import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { TimestampSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { JsonStringSchema } from "@/validation/common-schemas.ts";

const UnitDeathLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.UNIT_DEATH), // type
  Schema.String, // unitId
  JsonStringSchema, // unitName
  Schema.String, // sourcePlayerId
  JsonStringSchema, // sourcePlayerName
  Schema.String, // abilityId
  JsonStringSchema, // abilityName
  Schema.String, // relatedAbilityId
  Schema.FiniteFromString, // dungeonProgress
]);

const UnitDeathEventSchema = Schema.Struct({
  abilityId: Schema.String,
  abilityName: Schema.String,
  dungeonProgress: Schema.Finite,
  relatedAbilityId: Schema.String,
  sourcePlayerId: Schema.String,
  sourcePlayerName: Schema.String,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.UNIT_DEATH),
  unitId: Schema.String,
  unitInstanceId: Schema.String,
  unitName: Schema.String,
  unitTypeId: Schema.String,
});

function parseUnitId(unitId: string): {
  readonly unitInstanceId: string;
  readonly unitTypeId: string;
} {
  const segments = unitId.split("-");
  const unitTypeId = segments.at(-1);
  const unitInstanceId = segments.at(-2);

  if (unitInstanceId === undefined || unitTypeId === undefined) {
    return {
      unitInstanceId: unitId,
      unitTypeId: "0",
    };
  }

  return {
    unitInstanceId,
    unitTypeId,
  };
}

export const UnitDeathEventFromLogSchema = UnitDeathLogLineSchema.pipe(
  Schema.decodeTo(UnitDeathEventSchema, {
    decode: SchemaGetter.transform(
      ([
        timestamp,
        type,
        unitId,
        unitName,
        sourcePlayerId,
        sourcePlayerName,
        abilityId,
        abilityName,
        relatedAbilityId,
        dungeonProgress,
      ]) => {
        const { unitInstanceId, unitTypeId } = parseUnitId(unitId);

        return {
          abilityId,
          abilityName,
          dungeonProgress,
          relatedAbilityId,
          sourcePlayerId,
          sourcePlayerName,
          timestamp,
          type,
          unitId,
          unitInstanceId,
          unitName,
          unitTypeId,
        };
      },
    ),

    encode: SchemaGetter.transform((event) => {
      return [
        event.timestamp,
        event.type,
        event.unitId,
        event.unitName,
        event.sourcePlayerId,
        event.sourcePlayerName,
        event.abilityId,
        event.abilityName,
        event.relatedAbilityId,
        event.dungeonProgress,
      ] as const;
    }),
  }),
);
