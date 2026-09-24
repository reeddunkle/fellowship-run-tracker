import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const ExternalMobDataEntrySchema = Schema.Struct({
  DevKey: NonEmptyStringSchema,
  DevName: NonEmptyStringSchema,
  DevZoneName: NonEmptyStringSchema,
  FoundInZoneFSLIDs: Schema.Array(Schema.Finite),
  FoundInZoneGameIDs: Schema.Array(Schema.Finite),
  FSLName: NonEmptyStringSchema,
  KillScore: Schema.NullOr(Schema.Finite),
  PlacedInZones: Schema.Array(NonEmptyStringSchema),
});

export const ExternalMobDataSchema = Schema.Record(
  NonEmptyStringSchema,
  ExternalMobDataEntrySchema,
);

export type ExternalMobData = typeof ExternalMobDataSchema.Type;
