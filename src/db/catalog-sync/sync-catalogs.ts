import * as E from "effect/Effect";

import { syncAbilityCatalog } from "@/db/catalog-sync/sync-ability-catalog.ts";
import { syncDungeonCatalog } from "@/db/catalog-sync/sync-dungeon-catalog.ts";
import { syncEncounterCatalog } from "@/db/catalog-sync/sync-encounter-catalog.ts";
import { syncUnitCatalog } from "@/db/catalog-sync/sync-unit-catalog.ts";

// Catalog groups run sequentially; catalogs within a group can sync concurrently.
const syncGroups = [
  [syncDungeonCatalog()],
  [syncEncounterCatalog(), syncUnitCatalog()],
  [syncAbilityCatalog()],
] as const;

export const syncCatalogs = E.forEach(
  syncGroups,
  (group) => {
    return E.all(group, {
      concurrency: "unbounded",
      discard: true,
    });
  },
  {
    concurrency: 1,
    discard: true,
  },
);
