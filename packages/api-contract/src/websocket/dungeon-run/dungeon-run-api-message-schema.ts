import * as Schema from "effect/Schema";

import { DungeonRunStatusSchema } from "@frt/api-contract/validation/dungeon-run/dungeon-run-status-schema.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";

const TimestampMillisecondsSchema = PositiveIntegerSchema;

const DungeonRunObservationApiSchema = Schema.Struct({
  targetId: NonEmptyStringSchema,
  timestampMilliseconds: TimestampMillisecondsSchema,
  type: RequirementEventTypeSchema,
});

const DungeonRunApiSchema = Schema.Struct({
  endedAtMilliseconds: Schema.NullOr(TimestampMillisecondsSchema),
  startedAtMilliseconds: Schema.NullOr(TimestampMillisecondsSchema),
  status: DungeonRunStatusSchema,
});

const DungeonRunStateApiSchema = Schema.Struct({
  dungeonRun: Schema.NullOr(DungeonRunApiSchema),
  observations: Schema.Array(DungeonRunObservationApiSchema),
});

export const DungeonRunApiMessageSchema = Schema.Struct({
  state: DungeonRunStateApiSchema,
  version: Schema.Literal(1),
});

export type DungeonRunObservationApi =
  typeof DungeonRunObservationApiSchema.Type;

export type DungeonRunStateApi = typeof DungeonRunStateApiSchema.Type;

export type DungeonRunApiMessage = typeof DungeonRunApiMessageSchema.Type;
