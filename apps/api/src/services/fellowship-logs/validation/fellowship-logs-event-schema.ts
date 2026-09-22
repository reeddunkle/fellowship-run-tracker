import * as Schema from "effect/Schema";

import { NonNegativeIntegerSchema } from "@frt/shared/validation/common-schemas.ts";

const FellowshipLogsDungeonStartEventSchema = Schema.Struct({
  affixes: Schema.Array(Schema.Int),
  difficulty: Schema.Int,
  encounterID: Schema.Int,
  fight: Schema.Int,
  gameMode: Schema.Int,
  level: Schema.Int,
  name: Schema.String,
  size: Schema.Int,
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("dungeonstart"),
});

const FellowshipLogsDungeonEndEventSchema = Schema.Struct({
  encounterID: Schema.Int,
  kill: Schema.Boolean,
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("dungeonend"),
});

const FellowshipLogsCastEventSchema = Schema.Struct({
  abilityGameID: Schema.Int,
  fight: Schema.Int,
  sourceID: Schema.Int,
  targetID: Schema.Int,
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("cast"),
});

const FellowshipLogsDeathEventSchema = Schema.Struct({
  targetID: Schema.Int,
  targetInstance: Schema.Int.pipe(Schema.optional),
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("death"),
});

export const FellowshipLogsConvertibleEventSchema = Schema.Union([
  FellowshipLogsCastEventSchema,
  FellowshipLogsDeathEventSchema,
  FellowshipLogsDungeonEndEventSchema,
  FellowshipLogsDungeonStartEventSchema,
]);

export type FellowshipLogsConvertibleEvent =
  typeof FellowshipLogsConvertibleEventSchema.Type;
