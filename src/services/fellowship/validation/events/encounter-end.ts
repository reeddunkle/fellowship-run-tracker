import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import {
  EncounterIdSchema,
  TimestampSchema,
} from "@/services/fellowship/validation/fellowship-common.ts";
import {
  BooleanFlagSchema,
  JsonStringArraySchema,
} from "@/validation/common-schemas.ts";

const EncounterEndLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.ENCOUNTER_END), // type
  Schema.String, // encounterId
  JsonStringArraySchema, // encounterNames
  BooleanFlagSchema, // succeeded
]);

const EncounterEndEventSchema = Schema.Struct({
  encounterId: EncounterIdSchema,
  encounterNames: Schema.Array(Schema.String),
  succeeded: Schema.Boolean,
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.ENCOUNTER_END),
});

export const EncounterEndEventFromLogSchema = EncounterEndLogLineSchema.pipe(
  Schema.decodeTo(EncounterEndEventSchema, {
    decode: SchemaGetter.transform(
      ([timestamp, type, encounterId, encounterNames, succeeded]) => {
        return {
          encounterId,
          encounterNames,
          succeeded,
          timestamp,
          type,
        };
      },
    ),

    encode: SchemaGetter.transform((event) => {
      return [
        event.timestamp,
        event.type,
        event.encounterId,
        event.encounterNames,
        event.succeeded,
      ] as const;
    }),
  }),
);
