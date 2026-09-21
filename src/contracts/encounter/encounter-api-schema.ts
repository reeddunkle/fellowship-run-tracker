import * as Schema from "effect/Schema";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const EncounterApiEncounterSchema = Schema.Struct({
  createdAt: Schema.DateTimeUtcFromString,
  dungeonId: DungeonIdSchema,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  updatedAt: Schema.DateTimeUtcFromString,
});

export type EncounterApiEncounter = typeof EncounterApiEncounterSchema.Type;

export const EncounterApiEncounterListSchema = Schema.Array(
  EncounterApiEncounterSchema,
);

export type EncounterApiEncounterList =
  typeof EncounterApiEncounterListSchema.Type;
