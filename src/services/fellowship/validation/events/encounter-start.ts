import { SchemaGetter } from "effect";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import {
  EncounterIdSchema,
  TimestampSchema,
} from "@/services/fellowship/validation/fellowship-common.ts";
import { JsonStringArraySchema } from "@/validation/common-schemas.ts";

const EncounterStartLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString, // timestamp
  Schema.Literal(FELLOWSHIP_EVENT.ENCOUNTER_START), // type
  Schema.String, // encounterId
  JsonStringArraySchema, // encounterNames
]);

const EncounterStartEventSchema = Schema.Struct({
  encounterId: EncounterIdSchema,
  encounterNames: Schema.Array(Schema.String),
  timestamp: TimestampSchema,
  type: Schema.Literal(FELLOWSHIP_EVENT.ENCOUNTER_START),
});

export const EncounterStartEventFromLogSchema =
  EncounterStartLogLineSchema.pipe(
    Schema.decodeTo(EncounterStartEventSchema, {
      decode: SchemaGetter.transform(
        ([timestamp, type, encounterId, encounterNames]) => {
          return {
            encounterId,
            encounterNames,
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
        ] as const;
      }),
    }),
  );
