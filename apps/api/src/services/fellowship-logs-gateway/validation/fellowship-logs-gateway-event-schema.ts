import * as Schema from "effect/Schema";

import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsGatewayDungeonStartEventSchema = Schema.Struct({
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

const FellowshipLogsGatewayDungeonEndEventSchema = Schema.Struct({
  encounterID: Schema.Int,
  kill: Schema.Boolean,
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("dungeonend"),
});

const FellowshipLogsGatewayCastEventSchema = Schema.Struct({
  abilityGameID: Schema.Int,
  fight: Schema.Int,
  sourceID: Schema.Int,
  targetID: Schema.Int,
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("cast"),
});

const FellowshipLogsGatewayDeathEventSchema = Schema.Struct({
  targetID: Schema.Int,
  targetInstance: Schema.Int.pipe(Schema.optional),
  timestamp: NonNegativeIntegerSchema,
  type: Schema.Literal("death"),
});

export const FellowshipLogsGatewayConvertibleEventSchema = Schema.Union([
  FellowshipLogsGatewayCastEventSchema,
  FellowshipLogsGatewayDeathEventSchema,
  FellowshipLogsGatewayDungeonEndEventSchema,
  FellowshipLogsGatewayDungeonStartEventSchema,
]);

export type FellowshipLogsGatewayConvertibleEvent =
  typeof FellowshipLogsGatewayConvertibleEventSchema.Type;
