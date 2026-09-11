import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { TimestampSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import {
  IntegerFromStringSchema,
  JsonStringSchema,
} from "@/validation/common-schemas.ts";

const AbilityActivatedLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.ABILITY_ACTIVATED), // type
  Schema.String, // sourceId
  JsonStringSchema, // sourceName
  Schema.String, // abilityId
  JsonStringSchema, // abilityName
  IntegerFromStringSchema, // hasTarget
  Schema.String, // targetId
  JsonStringSchema, // targetName
  IntegerFromStringSchema, // currentHealth
  IntegerFromStringSchema, // maximumHealth
  IntegerFromStringSchema, // resourceValue
  Schema.FiniteFromString, // positionX
  Schema.FiniteFromString, // positionY
  Schema.FiniteFromString, // positionZ
  Schema.String, // unmappedArrayData
]);

const AbilityActivatedEventSchema = Schema.Struct({
  abilityId: Schema.String,
  abilityName: Schema.String,
  hasTarget: Schema.Boolean,
  sourceId: Schema.String,
  sourceName: Schema.String,
  targetId: Schema.String,
  targetName: Schema.String,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.ABILITY_ACTIVATED),
  unmapped: Schema.Struct({
    currentHealth: Schema.Finite,
    maximumHealth: Schema.Finite,
    positionX: Schema.Finite,
    positionY: Schema.Finite,
    positionZ: Schema.Finite,
    resourceValue: Schema.Finite,
    unmappedArrayData: Schema.String,
  }),
});

export const AbilityActivatedEventFromLogSchema =
  AbilityActivatedLogLineSchema.pipe(
    Schema.decodeTo(AbilityActivatedEventSchema, {
      decode: SchemaGetter.transform(
        ([
          timestamp,
          type,
          sourceId,
          sourceName,
          abilityId,
          abilityName,
          hasTarget,
          targetId,
          targetName,
          currentHealth,
          maximumHealth,
          resourceValue,
          positionX,
          positionY,
          positionZ,
          unmappedArrayData,
        ]) => {
          return {
            abilityId,
            abilityName,
            hasTarget: hasTarget === 1,
            sourceId,
            sourceName,
            targetId,
            targetName,
            timestamp,
            type,
            unmapped: {
              currentHealth,
              maximumHealth,
              positionX,
              positionY,
              positionZ,
              resourceValue,
              unmappedArrayData,
            },
          };
        },
      ),
      encode: SchemaGetter.transform((event) => {
        return [
          event.timestamp,
          event.type,
          event.sourceId,
          event.sourceName,
          event.abilityId,
          event.abilityName,
          event.hasTarget ? 1 : 0,
          event.targetId,
          event.targetName,
          event.unmapped.currentHealth,
          event.unmapped.maximumHealth,
          event.unmapped.resourceValue,
          event.unmapped.positionX,
          event.unmapped.positionY,
          event.unmapped.positionZ,
          event.unmapped.unmappedArrayData,
        ] as const;
      }),
    }),
  );
