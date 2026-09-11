import * as E from "effect/Effect";

import { seedAbilityTable } from "@/db/seed/seed-ability-table.ts";
import { seedDungeonTable } from "@/db/seed/seed-dungeon-table.ts";
import { seedEncounterTable } from "@/db/seed/seed-encounter-table.ts";
import { seedUnitTable } from "@/db/seed/seed-unit-table.ts";

// Seed groups run sequentially; seeds within a group can run concurrently.
const seedGroups = [
  [seedDungeonTable],
  [seedEncounterTable, seedUnitTable],
  [seedAbilityTable],
] as const;

export const seedTables = E.forEach(
  seedGroups,
  (group) =>
    E.all(group, {
      concurrency: "unbounded",
      discard: true,
    }),
  {
    concurrency: 1,
    discard: true,
  },
);
