import * as Schema from "effect/Schema";

import { FellowshipUnitCatalogSchema } from "@frt/db/catalogs/unit/fellowship-unit-catalog-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const CatalogMetadataSchema = Schema.Struct({
  reason: NonEmptyStringSchema,
  source: NonEmptyStringSchema,
});

const DungeonCatalogEntrySchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  mapId: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
});

const DungeonCatalogPatchSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  mapId: Schema.optional(NonEmptyStringSchema),
  name: Schema.optional(NonEmptyStringSchema),
});

const EncounterCatalogEntrySchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  encounterId: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
});

const EncounterCatalogPatchSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  encounterId: NonEmptyStringSchema,
  name: Schema.optional(NonEmptyStringSchema),
});

const UnitCatalogEntrySchema = FellowshipUnitCatalogSchema.value;

const UnitCatalogPatchSchema = Schema.Struct({
  dungeonIds: Schema.optional(UnitCatalogEntrySchema.fields.dungeonIds),
  groupKey: Schema.optional(UnitCatalogEntrySchema.fields.groupKey),
  id: UnitCatalogEntrySchema.fields.id,
  name: Schema.optional(UnitCatalogEntrySchema.fields.name),
  status: Schema.optional(UnitCatalogEntrySchema.fields.status),
  variant: Schema.optional(UnitCatalogEntrySchema.fields.variant),
});

export const FellowshipSeasonalCatalogSchema = Schema.Struct({
  dungeons: Schema.Struct({
    additions: Schema.Array(DungeonCatalogEntrySchema),
    patches: Schema.Array(DungeonCatalogPatchSchema),
  }),
  encounters: Schema.Struct({
    additions: Schema.Array(EncounterCatalogEntrySchema),
    patches: Schema.Array(EncounterCatalogPatchSchema),
  }),
  metadata: CatalogMetadataSchema,
  units: Schema.Struct({
    additions: FellowshipUnitCatalogSchema,
    patches: Schema.Array(UnitCatalogPatchSchema),
  }),
});

export type FellowshipSeasonalCatalog =
  typeof FellowshipSeasonalCatalogSchema.Type;
