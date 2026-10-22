import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_ABILITY } from "@frt/db/catalogs/ability/fellowship-ability-catalog.ts";
import { FELLOWSHIP_DUNGEON } from "@frt/db/catalogs/dungeon/fellowship-dungeon-catalog.ts";
import { FELLOWSHIP_ENCOUNTER } from "@frt/db/catalogs/encounter/fellowship-encounter-catalog.ts";
import { FellowshipSeasonalCatalogSchema } from "@frt/db/catalogs/seasonal/fellowship-seasonal-catalog-schema.ts";
import { loadFellowshipUnitCatalog } from "@frt/db/catalogs/unit/load-fellowship-unit-catalog.ts";

import seasonalCatalogJson from "./seasonal/2026-10-22.json" with {
  type: "json",
};

type CatalogEntry = Readonly<Record<string, unknown>>;

function mergeCatalog<Entry extends CatalogEntry, Patch extends CatalogEntry>({
  additions,
  base,
  getKey,
  patches,
}: {
  readonly additions: ReadonlyArray<Entry>;
  readonly base: ReadonlyArray<Entry>;
  readonly getKey: (entry: Entry | Patch) => string;
  readonly patches: ReadonlyArray<Patch>;
}): ReadonlyArray<Entry> {
  const withAdditions = [...base, ...additions].reduce((entries, entry) => {
    return new Map(entries).set(getKey(entry), entry);
  }, new Map<string, Entry>());

  const merged = patches.reduce((entries, patch) => {
    const key = getKey(patch);
    const entry = entries.get(key);

    if (entry === undefined) {
      return entries;
    }

    return new Map(entries).set(key, {
      ...entry,
      ...patch,
    });
  }, withAdditions);

  return A.sort(
    Array.from(merged.values()),
    Order.mapInput(Order.String, getKey),
  );
}

export const loadEffectiveFellowshipCatalogs = E.gen(function* () {
  const seasonalCatalog = yield* Schema.decodeUnknownEffect(
    FellowshipSeasonalCatalogSchema,
  )(seasonalCatalogJson);
  const unitCatalog = yield* loadFellowshipUnitCatalog();

  const dungeons = mergeCatalog({
    additions: seasonalCatalog.dungeons.additions,
    base: Object.values(FELLOWSHIP_DUNGEON),
    getKey: (entry) => entry.dungeonId,
    patches: seasonalCatalog.dungeons.patches,
  });
  const encounters = mergeCatalog({
    additions: seasonalCatalog.encounters.additions,
    base: Object.values(FELLOWSHIP_ENCOUNTER),
    getKey: (entry) => `${entry.dungeonId}:${entry.encounterId}`,
    patches: seasonalCatalog.encounters.patches,
  });
  const units = mergeCatalog({
    additions: seasonalCatalog.units.additions,
    base: unitCatalog,
    getKey: (entry) => entry.id,
    patches: seasonalCatalog.units.patches,
  });

  const dungeonIds = new Set(
    dungeons.map((dungeon) => {
      return dungeon.dungeonId;
    }),
  );
  const referencedDungeonIds = [
    ...encounters.map((encounter) => {
      return encounter.dungeonId;
    }),
    ...units.flatMap((unit) => {
      return unit.dungeonIds;
    }),
  ];

  yield* E.forEach(referencedDungeonIds, (dungeonId) => {
    return dungeonIds.has(dungeonId)
      ? E.void
      : Schema.decodeUnknownEffect(Schema.Never)(dungeonId);
  });

  return {
    abilities: Object.values(FELLOWSHIP_ABILITY),
    dungeons,
    encounters,
    units,
  } as const;
});
